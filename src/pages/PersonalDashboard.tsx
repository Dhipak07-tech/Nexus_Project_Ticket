import React, { useEffect, useState } from "react";
import {
  Search,
  Ticket,
  ShoppingCart,
  BookOpen,
  MessageSquare,
  Clock,
  ChevronRight,
  PlusCircle,
  CheckCircle2,
  AlertCircle,
  FolderKanban,
  Activity,
  UserCheck,
  ClipboardList,
  TrendingUp,
} from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  Cell,
} from "recharts";
import {
  collection,
  collectionGroup,
  onSnapshot,
  orderBy,
  query,
} from "firebase/firestore";
import { useAuth } from "../contexts/AuthContext";
import { db } from "../lib/firebase";
import { cn, formatDate } from "../lib/utils";

function toMs(value: any): number {
  if (!value) return NaN;
  if (typeof value === "object" && typeof value.toDate === "function") return value.toDate().getTime();
  if (typeof value === "object" && value.seconds !== undefined) {
    return value.seconds * 1000 + (value.nanoseconds || 0) / 1_000_000;
  }
  if (typeof value === "number") return value;
  return new Date(value).getTime();
}

function startOfDay(value: number) {
  const date = new Date(value);
  date.setHours(0, 0, 0, 0);
  return date.getTime();
}

function startOfWeek(value: number) {
  const date = new Date(value);
  const day = date.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  date.setDate(date.getDate() + diff);
  date.setHours(0, 0, 0, 0);
  return date.getTime();
}

function startOfMonth(value: number) {
  const date = new Date(value);
  date.setDate(1);
  date.setHours(0, 0, 0, 0);
  return date.getTime();
}

function formatHours(hours: number) {
  if (!Number.isFinite(hours) || hours <= 0) return "0h";
  if (hours >= 24) return `${(hours / 24).toFixed(1)}d`;
  return `${hours.toFixed(1)}h`;
}

function getTicketTitle(ticket: any) {
  return ticket.title || ticket.shortDescription || ticket.description || "Untitled ticket";
}

function getTicketNumber(ticket: any) {
  return ticket.number || ticket.id?.slice(0, 8) || "Ticket";
}

function getTicketCreatedMs(ticket: any) {
  return toMs(ticket.createdAt) || toMs(ticket.updatedAt) || 0;
}

function getTicketResolvedMs(ticket: any) {
  return toMs(ticket.resolvedAt) || toMs(ticket.updatedAt) || 0;
}

function isClosedStatus(status: string) {
  return ["Resolved", "Closed", "Canceled"].includes(status || "");
}

function isPendingStatus(status: string) {
  return ["Pending", "Pending Approval", "On Hold", "Waiting for Customer", "Awaiting User", "Awaiting Vendor"].includes(status || "");
}

const PIE_COLORS = ["#0f766e", "#2563eb", "#f59e0b", "#ef4444", "#6366f1", "#14b8a6", "#64748b", "#84cc16"];

const STATUS_STYLES: Record<string, string> = {
  "New": "bg-slate-100 text-slate-700",
  "Open": "bg-blue-50 text-blue-700",
  "In Progress": "bg-amber-50 text-amber-700",
  "Resolved": "bg-emerald-50 text-emerald-700",
  "Closed": "bg-emerald-100 text-emerald-800",
  "Pending Approval": "bg-violet-50 text-violet-700",
  "On Hold": "bg-orange-50 text-orange-700",
  "Waiting for Customer": "bg-orange-50 text-orange-700",
  "Awaiting User": "bg-orange-50 text-orange-700",
};

export function PersonalDashboard() {
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const [tickets, setTickets] = useState<any[]>([]);
  const [comments, setComments] = useState<any[]>([]);
  const [searchValue, setSearchValue] = useState("");

  useEffect(() => {
    const unsubTickets = onSnapshot(
      query(collection(db, "tickets"), orderBy("createdAt", "desc")),
      (snapshot) => {
        setTickets(snapshot.docs.map((doc_) => ({ id: doc_.id, ...doc_.data() })));
      },
      () => {
        setTickets([]);
      }
    );

    const unsubComments = onSnapshot(
      collectionGroup(db, "comments"),
      (snapshot) => {
        setComments(snapshot.docs.map((doc_) => {
          const pathParts = doc_.ref.path.split("/");
          return {
            id: doc_.id,
            ...doc_.data(),
            ticketId: pathParts[pathParts.length - 3],
          };
        }));
      },
      () => {
        setComments([]);
      }
    );

    return () => {
      unsubTickets();
      unsubComments();
    };
  }, []);

  const displayName = profile?.name || user?.displayName || user?.email || "User";
  const normalizedName = displayName.toLowerCase().trim();
  const normalizedEmail = (user?.email || profile?.email || "").toLowerCase().trim();
  const userId = user?.uid || profile?.uid;
  const now = Date.now();
  const todayStart = startOfDay(now);
  const weekStart = startOfWeek(now);
  const monthStart = startOfMonth(now);

  const matchesCurrentUser = (value: any) => {
    const text = String(value || "").toLowerCase().trim();
    if (!text) return false;
    return text === userId || text === normalizedName || text === normalizedEmail;
  };

  const myCreatedTickets = tickets.filter((ticket) =>
    matchesCurrentUser(ticket.createdBy) ||
    matchesCurrentUser(ticket.createdByEmail) ||
    matchesCurrentUser(ticket.createdByName) ||
    matchesCurrentUser(ticket.caller) ||
    matchesCurrentUser(ticket.requestedBy) ||
    matchesCurrentUser(ticket.requesterName) ||
    matchesCurrentUser(ticket.affectedUser)
  );

  const myAssignedTickets = tickets.filter((ticket) =>
    matchesCurrentUser(ticket.assignedTo) ||
    matchesCurrentUser(ticket.assignedToName)
  );

  const myTicketMap = new Map<string, any>();
  [...myCreatedTickets, ...myAssignedTickets].forEach((ticket) => {
    myTicketMap.set(ticket.id, ticket);
  });
  const myTickets = Array.from(myTicketMap.values()).sort((a, b) => getTicketCreatedMs(b) - getTicketCreatedMs(a));

  const openTickets = myTickets.filter((ticket) => !isClosedStatus(ticket.status));
  const inProgressTickets = myTickets.filter((ticket) => ticket.status === "In Progress");
  const resolvedTickets = myTickets.filter((ticket) => ticket.status === "Resolved");
  const closedTickets = myTickets.filter((ticket) => ticket.status === "Closed");
  const pendingTickets = myTickets.filter((ticket) => isPendingStatus(ticket.status));
  const overdueTickets = myTickets.filter((ticket) => {
    if (isClosedStatus(ticket.status)) return false;
    const deadline = toMs(ticket.resolutionDeadline);
    return Number.isFinite(deadline) && deadline < now;
  });

  const completedTickets = myTickets.filter((ticket) => ticket.status === "Resolved" || ticket.status === "Closed");
  const completionPercentage = myTickets.length ? Math.round((completedTickets.length / myTickets.length) * 100) : 0;
  const averageResolutionHours = completedTickets.length
    ? completedTickets.reduce((sum, ticket) => {
        const created = getTicketCreatedMs(ticket);
        const resolved = getTicketResolvedMs(ticket);
        if (!created || !resolved || resolved < created) return sum;
        return sum + (resolved - created) / 3600000;
      }, 0) / completedTickets.length
    : 0;
  const ticketsCompletedToday = completedTickets.filter((ticket) => getTicketResolvedMs(ticket) >= todayStart).length;
  const weeklyPerformance = completedTickets.filter((ticket) => getTicketResolvedMs(ticket) >= weekStart).length;
  const monthlyPerformance = completedTickets.filter((ticket) => getTicketResolvedMs(ticket) >= monthStart).length;
  const onTimeResolvedCount = completedTickets.filter((ticket) => {
    const deadline = toMs(ticket.resolutionDeadline);
    const resolved = getTicketResolvedMs(ticket);
    return Number.isFinite(deadline) && resolved > 0 && resolved <= deadline;
  }).length;
  const onTimeRate = completedTickets.length ? onTimeResolvedCount / completedTickets.length : 0;
  const productivityScore = Math.max(
    0,
    Math.min(
      100,
      Math.round(
        completionPercentage * 0.5 +
        Math.min(weeklyPerformance * 8, 24) +
        onTimeRate * 20 +
        Math.min(ticketsCompletedToday * 3, 6)
      )
    )
  );

  const statusCounts = myTickets.reduce((acc: Record<string, number>, ticket) => {
    const key = ticket.status || "Unknown";
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});

  const statusChartData = Object.entries(statusCounts).map(([name, value]) => ({ name, value }));

  const categoryCounts = myTickets.reduce((acc: Record<string, number>, ticket) => {
    const key = ticket.category || "Uncategorized";
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});

  const categoryChartData = Object.entries(categoryCounts)
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 6);

  const trendMap = new Map<string, { label: string; created: number; resolved: number }>();
  for (let offset = 6; offset >= 0; offset -= 1) {
    const date = new Date(now - offset * 24 * 3600 * 1000);
    const label = date.toLocaleDateString(undefined, { weekday: "short" });
    const key = new Date(date.getFullYear(), date.getMonth(), date.getDate()).toISOString();
    trendMap.set(key, { label, created: 0, resolved: 0 });
  }

  myTickets.forEach((ticket) => {
    const createdMs = getTicketCreatedMs(ticket);
    if (createdMs >= now - 6 * 24 * 3600 * 1000) {
      const createdKey = new Date(startOfDay(createdMs)).toISOString();
      const item = trendMap.get(createdKey);
      if (item) item.created += 1;
    }

    const resolvedMs = getTicketResolvedMs(ticket);
    if (resolvedMs >= now - 6 * 24 * 3600 * 1000) {
      const resolvedKey = new Date(startOfDay(resolvedMs)).toISOString();
      const item = trendMap.get(resolvedKey);
      if (item && (ticket.status === "Resolved" || ticket.status === "Closed")) item.resolved += 1;
    }
  });

  const trendData = Array.from(trendMap.values());

  const activityMap = new Map<string, { label: string; updates: number; comments: number }>();
  for (let offset = 6; offset >= 0; offset -= 1) {
    const date = new Date(now - offset * 24 * 3600 * 1000);
    const key = new Date(date.getFullYear(), date.getMonth(), date.getDate()).toISOString();
    activityMap.set(key, {
      label: date.toLocaleDateString(undefined, { weekday: "short" }),
      updates: 0,
      comments: 0,
    });
  }

  myTickets.forEach((ticket) => {
    (ticket.history || []).forEach((entry: any) => {
      const timestamp = toMs(entry.timestamp);
      if (!timestamp || timestamp < now - 6 * 24 * 3600 * 1000) return;
      const key = new Date(startOfDay(timestamp)).toISOString();
      const item = activityMap.get(key);
      if (item) item.updates += 1;
    });
  });

  const myComments = comments
    .filter((comment) => myTicketMap.has(comment.ticketId) || matchesCurrentUser(comment.user_id) || matchesCurrentUser(comment.user_name))
    .sort((a, b) => toMs(b.createdAt) - toMs(a.createdAt));

  myComments.forEach((comment) => {
    const timestamp = toMs(comment.createdAt);
    if (!timestamp || timestamp < now - 6 * 24 * 3600 * 1000) return;
    const key = new Date(startOfDay(timestamp)).toISOString();
    const item = activityMap.get(key);
    if (item) item.comments += 1;
  });

  const productivityGraphData = Array.from(activityMap.values());

  const recentTicketUpdates = myTickets
    .flatMap((ticket) =>
      (ticket.history || []).map((entry: any) => ({
        id: `${ticket.id}-${entry.timestamp}-${entry.action}`,
        ticketId: ticket.id,
        ticketNumber: getTicketNumber(ticket),
        action: entry.action || "Updated ticket",
        timestamp: entry.timestamp,
      }))
    )
    .sort((a, b) => toMs(b.timestamp) - toMs(a.timestamp))
    .slice(0, 5);

  const recentAssignments = recentTicketUpdates
    .filter((entry) => entry.action.toLowerCase().includes("assign"))
    .slice(0, 4);

  const recentResolvedTickets = completedTickets
    .slice()
    .sort((a, b) => getTicketResolvedMs(b) - getTicketResolvedMs(a))
    .slice(0, 4);

  const pendingTasks = openTickets.slice(0, 4);
  const upcomingTasks = openTickets
    .filter((ticket) => {
      const deadline = toMs(ticket.resolutionDeadline);
      return Number.isFinite(deadline) && deadline >= now && deadline <= now + 3 * 24 * 3600 * 1000;
    })
    .sort((a, b) => toMs(a.resolutionDeadline) - toMs(b.resolutionDeadline))
    .slice(0, 4);
  const highPriorityTickets = openTickets
    .filter((ticket) => String(ticket.priority || "").includes("Critical") || String(ticket.priority || "").includes("High"))
    .slice(0, 4);
  const dueReminders = [...overdueTickets, ...upcomingTasks]
    .filter((ticket, index, array) => array.findIndex((item) => item.id === ticket.id) === index)
    .slice(0, 4);

  const analyticsCards = [
    { label: "Total Tickets Assigned", value: myAssignedTickets.length, icon: UserCheck },
    { label: "Total Tickets Created", value: myCreatedTickets.length, icon: ClipboardList },
    { label: "Open Tickets", value: openTickets.length, icon: FolderKanban },
    { label: "In Progress Tickets", value: inProgressTickets.length, icon: Activity },
    { label: "Resolved Tickets", value: resolvedTickets.length, icon: CheckCircle2 },
    { label: "Closed Tickets", value: closedTickets.length, icon: CheckCircle2 },
    { label: "Pending Tickets", value: pendingTickets.length, icon: Clock },
    { label: "Overdue Tickets", value: overdueTickets.length, icon: AlertCircle },
  ];

  const performanceCards = [
    { label: "Completion Rate", value: `${completionPercentage}%` },
    { label: "Average Resolution", value: formatHours(averageResolutionHours) },
    { label: "Completed Today", value: ticketsCompletedToday },
    { label: "Weekly Performance", value: weeklyPerformance },
    { label: "Monthly Performance", value: monthlyPerformance },
    { label: "Productivity Score", value: productivityScore },
  ];

  const handleSearch = () => {
    if (!searchValue.trim()) return;
    navigate(`/tickets?search=${encodeURIComponent(searchValue.trim())}`);
  };

  return (
    <div className="space-y-12 max-w-6xl mx-auto pb-12">
      <div className="text-center space-y-6 py-8">
        <p className="text-xs font-black uppercase tracking-[0.3em] text-sn-green">Personal Dashboard</p>
        <h1 className="text-5xl font-light text-sn-dark">{displayName.split(" ")[0]}'s workspace</h1>
        <div className="max-w-2xl mx-auto relative group">
          <Search className="w-6 h-6 absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground group-focus-within:text-sn-green transition-colors" />
          <input
            type="text"
            value={searchValue}
            onChange={(event) => setSearchValue(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") handleSearch();
            }}
            placeholder="Search your tickets..."
            className="w-full bg-white border border-border rounded-2xl py-5 pl-14 pr-6 text-xl outline-none shadow-xl focus:ring-2 focus:ring-sn-green transition-all"
          />
        </div>
      </div>

      <section className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-sn-dark">My Ticket Analytics</h2>
            <p className="text-sm text-muted-foreground">Live dashboard metrics for tickets related to your account.</p>
          </div>
          <div className="text-xs font-semibold text-sn-green flex items-center gap-2">
            <TrendingUp className="w-4 h-4" />
            User scoped
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          {analyticsCards.map((card) => (
            <div key={card.label} className="sn-card p-5 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-black uppercase tracking-widest text-muted-foreground">{card.label}</span>
                <card.icon className="w-4 h-4 text-sn-green" />
              </div>
              <div className="text-3xl font-light text-sn-dark">{card.value}</div>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
          {performanceCards.map((card) => (
            <div key={card.label} className="sn-card p-5">
              <div className="text-[11px] font-black uppercase tracking-widest text-muted-foreground mb-2">{card.label}</div>
              <div className="text-2xl font-light text-sn-dark">{card.value}</div>
            </div>
          ))}
        </div>
      </section>

      <section className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <div className="sn-card p-5">
          <h3 className="text-sm font-bold text-sn-dark mb-4">Ticket Status Chart</h3>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={statusChartData} dataKey="value" nameKey="name" innerRadius={55} outerRadius={90} paddingAngle={2}>
                  {statusChartData.map((entry, index) => (
                    <Cell key={entry.name} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="sn-card p-5">
          <h3 className="text-sm font-bold text-sn-dark mb-4">Category Distribution</h3>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={categoryChartData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="name" fontSize={11} />
                <YAxis allowDecimals={false} fontSize={11} />
                <Tooltip />
                <Bar dataKey="value" fill="#0f766e" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="sn-card p-5">
          <h3 className="text-sm font-bold text-sn-dark mb-4">Daily Ticket Trend</h3>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={trendData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="label" fontSize={11} />
                <YAxis allowDecimals={false} fontSize={11} />
                <Tooltip />
                <Legend />
                <Line type="monotone" dataKey="created" stroke="#2563eb" strokeWidth={2.5} />
                <Line type="monotone" dataKey="resolved" stroke="#0f766e" strokeWidth={2.5} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="sn-card p-5">
          <h3 className="text-sm font-bold text-sn-dark mb-4">Individual Productivity Activity</h3>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={productivityGraphData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="label" fontSize={11} />
                <YAxis allowDecimals={false} fontSize={11} />
                <Tooltip />
                <Legend />
                <Bar dataKey="updates" fill="#0f766e" radius={[6, 6, 0, 0]} />
                <Bar dataKey="comments" fill="#f59e0b" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </section>

      <section className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <div className="sn-card p-5 space-y-5">
          <h3 className="text-sm font-bold text-sn-dark">Recent Activity</h3>

          <div>
            <div className="text-[11px] font-black uppercase tracking-widest text-muted-foreground mb-3">Recent Ticket Updates</div>
            <div className="space-y-3">
              {recentTicketUpdates.length === 0 ? (
                <div className="text-sm text-muted-foreground">No recent ticket updates yet.</div>
              ) : (
                recentTicketUpdates.map((entry) => (
                  <Link key={entry.id} to={`/tickets/${entry.ticketId}`} className="block rounded-xl border border-border p-3 hover:bg-muted/30 transition-colors">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <div className="text-sm font-bold text-sn-dark">{entry.ticketNumber}</div>
                        <div className="text-xs text-muted-foreground">{entry.action}</div>
                      </div>
                      <div className="text-[10px] text-muted-foreground whitespace-nowrap">{formatDate(entry.timestamp)}</div>
                    </div>
                  </Link>
                ))
              )}
            </div>
          </div>

          <div>
            <div className="text-[11px] font-black uppercase tracking-widest text-muted-foreground mb-3">Recent Assignments</div>
            <div className="space-y-3">
              {recentAssignments.length === 0 ? (
                <div className="text-sm text-muted-foreground">No recent assignments recorded.</div>
              ) : (
                recentAssignments.map((entry) => (
                  <Link key={entry.id} to={`/tickets/${entry.ticketId}`} className="block rounded-xl border border-border p-3 hover:bg-muted/30 transition-colors">
                    <div className="text-sm font-semibold text-sn-dark">{entry.ticketNumber}</div>
                    <div className="text-xs text-muted-foreground">{entry.action}</div>
                  </Link>
                ))
              )}
            </div>
          </div>

          <div>
            <div className="text-[11px] font-black uppercase tracking-widest text-muted-foreground mb-3">Recent Comments</div>
            <div className="space-y-3">
              {myComments.slice(0, 4).length === 0 ? (
                <div className="text-sm text-muted-foreground">No recent comments available.</div>
              ) : (
                myComments.slice(0, 4).map((comment) => (
                  <Link key={comment.id} to={`/tickets/${comment.ticketId}`} className="block rounded-xl border border-border p-3 hover:bg-muted/30 transition-colors">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <div className="text-sm font-semibold text-sn-dark">{comment.user_name || "Comment"}</div>
                        <div className="text-xs text-muted-foreground line-clamp-2">{comment.message || "Comment added"}</div>
                      </div>
                      <div className="text-[10px] text-muted-foreground whitespace-nowrap">{formatDate(comment.createdAt)}</div>
                    </div>
                  </Link>
                ))
              )}
            </div>
          </div>

          <div>
            <div className="text-[11px] font-black uppercase tracking-widest text-muted-foreground mb-3">Recent Resolved Tickets</div>
            <div className="space-y-3">
              {recentResolvedTickets.length === 0 ? (
                <div className="text-sm text-muted-foreground">No resolved tickets yet.</div>
              ) : (
                recentResolvedTickets.map((ticket) => (
                  <Link key={ticket.id} to={`/tickets/${ticket.id}`} className="block rounded-xl border border-border p-3 hover:bg-muted/30 transition-colors">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <div className="text-sm font-semibold text-sn-dark">{getTicketNumber(ticket)}</div>
                        <div className="text-xs text-muted-foreground">{getTicketTitle(ticket)}</div>
                      </div>
                      <div className="text-[10px] text-muted-foreground whitespace-nowrap">{formatDate(ticket.resolvedAt || ticket.updatedAt)}</div>
                    </div>
                  </Link>
                ))
              )}
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <div className="sn-card p-5 space-y-4">
            <h3 className="text-sm font-bold text-sn-dark">My Tasks</h3>

            <TaskBlock title="Pending Tasks" items={pendingTasks} emptyLabel="No pending tasks." />
            <TaskBlock title="Upcoming Tasks" items={upcomingTasks} emptyLabel="No upcoming deadlines." />
            <TaskBlock title="High Priority Tickets" items={highPriorityTickets} emptyLabel="No high priority tickets." />
            <TaskBlock title="Due Reminders" items={dueReminders} emptyLabel="No reminders right now." />
          </div>

          <div className="sn-card p-5 space-y-4">
            <h3 className="text-sm font-bold text-sn-dark">Quick Actions</h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <Button className="bg-sn-green text-sn-dark font-bold" asChild>
                <Link to="/tickets?action=new">Create Ticket</Link>
              </Button>
              <Button variant="outline" className="font-bold" asChild>
                <Link to="/timesheet">View My Tickets</Link>
              </Button>
              <Button variant="outline" className="font-bold" onClick={handleSearch}>
                Search Tickets
              </Button>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

function TaskBlock({
  title,
  items,
  emptyLabel,
}: {
  title: string;
  items: any[];
  emptyLabel: string;
}) {
  return (
    <div>
      <div className="text-[11px] font-black uppercase tracking-widest text-muted-foreground mb-3">{title}</div>
      <div className="space-y-3">
        {items.length === 0 ? (
          <div className="text-sm text-muted-foreground">{emptyLabel}</div>
        ) : (
          items.map((ticket) => (
            <Link key={ticket.id} to={`/tickets/${ticket.id}`} className="block rounded-xl border border-border p-3 hover:bg-muted/30 transition-colors">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="text-sm font-semibold text-sn-dark">{getTicketNumber(ticket)}</div>
                  <div className="text-xs text-muted-foreground">{getTicketTitle(ticket)}</div>
                </div>
                <div className="text-right">
                  <div className={cn("px-2 py-0.5 rounded text-[10px] font-bold uppercase", STATUS_STYLES[ticket.status || ""] || "bg-slate-100 text-slate-700")}>
                    {ticket.status || "New"}
                  </div>
                  {ticket.resolutionDeadline && (
                    <div className="text-[10px] text-muted-foreground mt-1">{formatDate(ticket.resolutionDeadline)}</div>
                  )}
                </div>
              </div>
            </Link>
          ))
        )}
      </div>
    </div>
  );
}
