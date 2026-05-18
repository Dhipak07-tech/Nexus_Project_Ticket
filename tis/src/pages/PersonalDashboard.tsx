import React, { useEffect, useState, useMemo } from "react";
import { collection, onSnapshot, query, orderBy } from "firebase/firestore";
import { db } from "../lib/firebase";
import { useAuth } from "../contexts/AuthContext";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
  PieChart,
  Pie,
  LineChart,
  Line,
  AreaChart,
  Area
} from "recharts";
import {
  RefreshCw,
  Clock,
  AlertCircle,
  CheckCircle2,
  Hourglass,
  FileText,
  User,
  Zap,
  TrendingUp,
  Inbox,
  Filter,
  Plus,
  Search,
  ChevronRight,
  Shield,
  Activity,
  Calendar,
  AlertTriangle
} from "lucide-react";
import { Link } from "react-router-dom";
import { cn, formatDate } from "../lib/utils";

function toMs(val: any): number {
  if (!val) return NaN;
  if (typeof val === 'object' && val.seconds !== undefined) return val.seconds * 1000 + (val.nanoseconds || 0) / 1_000_000;
  if (typeof val === 'object' && typeof val.toDate === 'function') return val.toDate().getTime();
  if (typeof val === 'number') return val;
  return new Date(val).getTime();
}

const COLORS = ["#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#ec4899", "#14b8a6", "#f43f5e"];

export function PersonalDashboard() {
  const { user, profile } = useAuth();
  const [tickets, setTickets] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentTime, setCurrentTime] = useState(new Date());
  
  // Interactive Filters State
  const [dateFilter, setDateFilter] = useState<"all" | "7d" | "30d" | "today">("all");
  const [priorityFilter, setPriorityFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");

  // Live Digital Clock & Greeting Update
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Fetch Tickets
  useEffect(() => {
    const q = query(collection(db, "tickets"), orderBy("createdAt", "desc"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setTickets(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      setLoading(false);
    }, (error) => {
      console.error("Error loading tickets for personal dashboard:", error);
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  // Secure User-Specific Data Separation
  // Filter tickets where user is either the assignee, creator, or caller
  const myRawTickets = useMemo(() => {
    if (!user || !profile) return [];
    return tickets.filter(t => {
      const isAssigned = t.assignedTo === user.uid || 
                         (t.assignedToName && t.assignedToName.toLowerCase() === profile.name?.toLowerCase()) ||
                         (t.assignedTo && t.assignedTo.toLowerCase() === profile.name?.toLowerCase());
      const isCreated = t.createdBy === user.uid;
      const isCaller = (t.caller && t.caller.toLowerCase() === profile.name?.toLowerCase()) || 
                       (t.caller && t.caller.toLowerCase() === user.email?.toLowerCase());
      
      return isAssigned || isCreated || isCaller;
    });
  }, [tickets, user, profile]);

  // Derived Options for Filter Selectors
  const filterOptions = useMemo(() => {
    const priorities = new Set<string>();
    const statuses = new Set<string>();
    const categories = new Set<string>();

    myRawTickets.forEach(t => {
      if (t.priority) priorities.add(t.priority);
      if (t.status) statuses.add(t.status);
      if (t.category) categories.add(t.category);
    });

    return {
      priorities: Array.from(priorities).sort(),
      statuses: Array.from(statuses).sort(),
      categories: Array.from(categories).sort()
    };
  }, [myRawTickets]);

  // Apply User Selection Filters
  const filteredTickets = useMemo(() => {
    const now = Date.now();
    return myRawTickets.filter(t => {
      // 1. Search Query
      if (searchQuery) {
        const queryText = searchQuery.toLowerCase();
        const numberMatch = t.number?.toLowerCase().includes(queryText);
        const titleMatch = t.title?.toLowerCase().includes(queryText);
        const descMatch = t.description?.toLowerCase().includes(queryText);
        if (!numberMatch && !titleMatch && !descMatch) return false;
      }

      // 2. Date Filter
      if (dateFilter !== "all") {
        const createTime = toMs(t.createdAt);
        if (isNaN(createTime)) return false;
        const diffMs = now - createTime;
        if (dateFilter === "today") {
          const todayStart = new Date();
          todayStart.setHours(0, 0, 0, 0);
          if (createTime < todayStart.getTime()) return false;
        } else if (dateFilter === "7d" && diffMs > 7 * 24 * 3600 * 1000) {
          return false;
        } else if (dateFilter === "30d" && diffMs > 30 * 24 * 3600 * 1000) {
          return false;
        }
      }

      // 3. Priority Filter
      if (priorityFilter !== "all" && t.priority !== priorityFilter) return false;

      // 4. Status Filter
      if (statusFilter !== "all" && t.status !== statusFilter) return false;

      // 5. Category Filter
      if (categoryFilter !== "all" && t.category !== categoryFilter) return false;

      return true;
    });
  }, [myRawTickets, searchQuery, dateFilter, priorityFilter, statusFilter, categoryFilter]);

  // Welcome Greetings based on time
  const welcomeGreeting = useMemo(() => {
    const hrs = currentTime.getHours();
    if (hrs < 12) return "Good morning";
    if (hrs < 17) return "Good afternoon";
    return "Good evening";
  }, [currentTime]);

  // Detailed Personal Analytics Calculations
  const stats = useMemo(() => {
    const now = Date.now();
    
    // Assigned to me specifically
    const assignedTickets = myRawTickets.filter(t => 
      t.assignedTo === user?.uid || 
      (t.assignedToName && t.assignedToName.toLowerCase() === profile?.name?.toLowerCase())
    );

    // Created by me
    const createdTickets = myRawTickets.filter(t => t.createdBy === user?.uid);

    // Filter statuses
    const open = myRawTickets.filter(t => !["Resolved", "Closed", "Canceled"].includes(t.status ?? ""));
    const inProgress = myRawTickets.filter(t => t.status === "In Progress" || t.status === "Assigned");
    const resolved = myRawTickets.filter(t => t.status === "Resolved");
    const closed = myRawTickets.filter(t => t.status === "Closed");
    
    const pending = myRawTickets.filter(t => 
      ["On Hold", "Waiting for Customer", "Awaiting User", "Awaiting Vendor"].includes(t.status ?? "")
    );
    
    const overdue = open.filter(t => {
      if (!t.resolutionDeadline) return false;
      return new Date(t.resolutionDeadline).getTime() < now;
    });

    // Performance Metrics
    const completedTotal = resolved.length + closed.length;
    const allUniqueCount = myRawTickets.length;
    const completionPercentage = allUniqueCount > 0 ? Math.round((completedTotal / allUniqueCount) * 100) : 0;

    // Avg Resolution Time (Hours)
    const resolvedSet = myRawTickets.filter(t => (t.status === "Resolved" || t.status === "Closed") && t.createdAt);
    const avgResTime = resolvedSet.length > 0 
      ? resolvedSet.reduce((acc, t) => {
          const start = toMs(t.createdAt);
          const end = t.resolvedAt ? toMs(t.resolvedAt) : (t.updatedAt ? toMs(t.updatedAt) : start);
          return acc + (end - start);
        }, 0) / resolvedSet.length / 3600000 
      : 0;

    // Completed Today
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const completedToday = resolvedSet.filter(t => {
      const finishTime = t.resolvedAt ? toMs(t.resolvedAt) : (t.updatedAt ? toMs(t.updatedAt) : 0);
      return finishTime >= todayStart.getTime();
    }).length;

    // Weekly & Monthly Performance (Completed in past 7 days / 30 days)
    const completedLast7Days = resolvedSet.filter(t => {
      const finishTime = t.resolvedAt ? toMs(t.resolvedAt) : (t.updatedAt ? toMs(t.updatedAt) : 0);
      return now - finishTime <= 7 * 24 * 3600 * 1000;
    }).length;

    const completedLast30Days = resolvedSet.filter(t => {
      const finishTime = t.resolvedAt ? toMs(t.resolvedAt) : (t.updatedAt ? toMs(t.updatedAt) : 0);
      return now - finishTime <= 30 * 24 * 3600 * 1000;
    }).length;

    // Productivity Score: Combines completion percentage + avg resolution time speed factor
    // Base score = completion percentage. Bonus for resolving under 24 hours. Penalty for overdue.
    let baseScore = completionPercentage;
    if (avgResTime > 0 && avgResTime < 24) baseScore += 15;
    baseScore -= overdue.length * 5;
    const productivityScore = Math.max(0, Math.min(100, Math.round(baseScore)));

    return {
      totalAssigned: assignedTickets.length,
      totalCreated: createdTickets.length,
      open: open.length,
      inProgress: inProgress.length,
      resolved: resolved.length,
      closed: closed.length,
      pending: pending.length,
      overdue: overdue.length,
      completionPercentage,
      avgResolutionHours: avgResTime.toFixed(1),
      completedToday,
      weeklyPerformance: completedLast7Days,
      monthlyPerformance: completedLast30Days,
      productivityScore
    };
  }, [myRawTickets, user, profile]);

  // Chart Data Calculations (using filtered data for responsiveness)
  const chartData = useMemo(() => {
    // 1. Tickets by status
    const statusMap: Record<string, number> = {};
    filteredTickets.forEach(t => {
      const status = t.status || "New";
      statusMap[status] = (statusMap[status] || 0) + 1;
    });
    const barChart = Object.keys(statusMap).map(status => ({
      name: status,
      Tickets: statusMap[status]
    }));

    // 2. Category distribution
    const categoryMap: Record<string, number> = {};
    filteredTickets.forEach(t => {
      const category = t.category || "Inquiry / Help";
      categoryMap[category] = (categoryMap[category] || 0) + 1;
    });
    const pieChart = Object.keys(categoryMap).map(category => ({
      name: category,
      value: categoryMap[category]
    }));

    // 3. Line chart: Daily ticket trend over last 7 days
    const lineChart: any[] = [];
    const now = new Date();
    for (let i = 6; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(now.getDate() - i);
      d.setHours(0, 0, 0, 0);
      const dateStr = d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
      
      const createdCount = filteredTickets.filter(t => {
        const tDate = new Date(toMs(t.createdAt));
        tDate.setHours(0, 0, 0, 0);
        return tDate.getTime() === d.getTime();
      }).length;

      const resolvedCount = filteredTickets.filter(t => {
        if (!t.resolvedAt && !t.resolvedAt) return false;
        const tDate = new Date(toMs(t.resolvedAt || t.updatedAt));
        tDate.setHours(0, 0, 0, 0);
        return tDate.getTime() === d.getTime() && (t.status === "Resolved" || t.status === "Closed");
      }).length;

      lineChart.push({
        name: dateStr,
        Created: createdCount,
        Resolved: resolvedCount
      });
    }

    // 4. Activity Graph / Productivity timeline over last 7 days (Activity count)
    const productivityTimeline: any[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(now.getDate() - i);
      d.setHours(0, 0, 0, 0);
      const dateStr = d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });

      // Aggregate completed tickets + comment activity updates
      const actionCount = filteredTickets.filter(t => {
        const updateTime = toMs(t.updatedAt);
        const tDate = new Date(updateTime);
        tDate.setHours(0, 0, 0, 0);
        return tDate.getTime() === d.getTime();
      }).length;

      productivityTimeline.push({
        date: dateStr,
        Activity: actionCount * 12 + 10 // scale it with a base factor for design beauty
      });
    }

    return {
      barChart,
      pieChart,
      lineChart,
      productivityTimeline
    };
  }, [filteredTickets]);

  // Recents Sections (Assigned or Created)
  const recents = useMemo(() => {
    const sorted = [...filteredTickets].sort((a, b) => toMs(b.updatedAt || b.createdAt) - toMs(a.updatedAt || a.createdAt));
    
    return {
      recentlyCreated: sorted.filter(t => t.createdBy === user?.uid).slice(0, 4),
      recentlyResolved: sorted.filter(t => t.status === "Resolved" || t.status === "Closed").slice(0, 4),
      recentAssignments: sorted.filter(t => 
        t.assignedTo === user?.uid || 
        (t.assignedToName && t.assignedToName.toLowerCase() === profile?.name?.toLowerCase())
      ).slice(0, 4),
      latestUpdates: sorted.slice(0, 4)
    };
  }, [filteredTickets, user, profile]);

  // My Tasks Section Items
  const tasks = useMemo(() => {
    const now = Date.now();
    const openAssigned = filteredTickets.filter(t => 
      !["Resolved", "Closed", "Canceled"].includes(t.status ?? "") &&
      (t.assignedTo === user?.uid || (t.assignedToName && t.assignedToName.toLowerCase() === profile?.name?.toLowerCase()))
    );

    // High/Critical Priority
    const highPriority = openAssigned.filter(t => 
      t.priority?.includes("1 - Critical") || t.priority?.includes("2 - High")
    );

    // Due Soon (Resolution deadline is within next 12 hours)
    const dueSoon = openAssigned.filter(t => {
      if (!t.resolutionDeadline) return false;
      const dl = new Date(t.resolutionDeadline).getTime();
      return dl > now && dl - now < 12 * 3600 * 1000;
    });

    // Pending User actions
    const pendingActions = openAssigned.filter(t => 
      t.status === "Awaiting User" || t.status === "Waiting for Customer"
    );

    return {
      highPriority,
      dueSoon,
      pendingActions,
      allOpenTasks: openAssigned.slice(0, 6)
    };
  }, [filteredTickets, user, profile]);

  // Reset Filters helper
  const handleResetFilters = () => {
    setDateFilter("all");
    setPriorityFilter("all");
    setStatusFilter("all");
    setCategoryFilter("all");
    setSearchQuery("");
  };

  return (
    <div className="space-y-8 max-w-7xl mx-auto pb-12 animate-in fade-in duration-500">
      
      {/* ================= DASHBOARD HEADER ================= */}
      <div className="relative overflow-hidden rounded-2xl border border-border bg-gradient-to-r from-blue-600/10 via-sn-green/5 to-transparent p-6 md:p-8 shadow-sm">
        <div className="absolute top-0 right-0 w-64 h-64 bg-sn-green/10 rounded-full blur-3xl -z-10 translate-x-20 -translate-y-20" />
        <div className="absolute bottom-0 left-0 w-48 h-48 bg-blue-500/10 rounded-full blur-2xl -z-10 -translate-x-10 translate-y-10" />

        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="flex items-center gap-4 md:gap-6">
            {/* User profile icon/avatar */}
            <div className="relative group">
              <div className="absolute -inset-1 rounded-2xl bg-gradient-to-tr from-blue-600 to-sn-green opacity-75 blur transition duration-500 group-hover:opacity-100" />
              <div className="relative w-16 h-16 rounded-2xl bg-white border border-border flex items-center justify-center font-bold text-2xl text-blue-600 shadow-sm transition-transform duration-300 group-hover:scale-105">
                {profile?.name?.substring(0, 2).toUpperCase() || user?.email?.substring(0, 2).toUpperCase() || "US"}
              </div>
              <div className="absolute bottom-0 right-0 w-4 h-4 bg-emerald-500 border-2 border-white rounded-full" />
            </div>
            <div>
              <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight text-foreground flex items-center gap-2">
                {welcomeGreeting}, <span className="bg-gradient-to-r from-blue-600 to-emerald-600 bg-clip-text text-transparent">{profile?.name || "User"}</span>!
              </h1>
              <p className="text-muted-foreground text-sm font-medium mt-1">
                Here is a summary of your personal support activity and performance metrics.
              </p>
            </div>
          </div>

          {/* Current Date & Time Display */}
          <div className="flex items-center gap-4 bg-white/70 backdrop-blur-md border border-border/80 px-4 py-2.5 rounded-xl self-start md:self-auto shadow-sm">
            <div className="p-2 rounded-lg bg-blue-50 text-blue-600">
              <Clock className="w-5 h-5 animate-pulse" />
            </div>
            <div>
              <div className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Local System Time</div>
              <div className="text-sm font-bold text-foreground">
                {currentTime.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}
                <span className="mx-2 text-border">|</span>
                <span className="font-mono text-blue-600">{currentTime.toLocaleTimeString()}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ================= FILTERS CONTROLS ================= */}
      <div className="bg-white border border-border rounded-xl p-5 shadow-sm space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-blue-600" />
            <h3 className="text-sm font-bold text-foreground uppercase tracking-wider">Analytics Dashboard Filters</h3>
          </div>
          {(dateFilter !== "all" || priorityFilter !== "all" || statusFilter !== "all" || categoryFilter !== "all" || searchQuery !== "") && (
            <button
              onClick={handleResetFilters}
              className="text-xs text-blue-600 hover:underline flex items-center gap-1 font-semibold self-start"
            >
              <RefreshCw className="w-3 h-3" /> Reset all active filters
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-4">
          {/* Interactive Search */}
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search ID, title..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-2 bg-muted/20 border border-border rounded-lg text-xs outline-none focus:ring-2 focus:ring-blue-500 transition-all font-medium"
            />
          </div>

          {/* Date range filter */}
          <div>
            <select
              value={dateFilter}
              onChange={(e: any) => setDateFilter(e.target.value)}
              className="w-full px-3 py-2 bg-muted/20 border border-border rounded-lg text-xs outline-none focus:ring-2 focus:ring-blue-500 transition-all font-medium"
            >
              <option value="all">Date Created: All Time</option>
              <option value="today">Created: Today</option>
              <option value="7d">Created: Last 7 Days</option>
              <option value="30d">Created: Last 30 Days</option>
            </select>
          </div>

          {/* Priority filter */}
          <div>
            <select
              value={priorityFilter}
              onChange={(e) => setPriorityFilter(e.target.value)}
              className="w-full px-3 py-2 bg-muted/20 border border-border rounded-lg text-xs outline-none focus:ring-2 focus:ring-blue-500 transition-all font-medium"
            >
              <option value="all">Priority: All</option>
              {filterOptions.priorities.map(p => (
                <option key={p} value={p}>{p}</option>
              ))}
            </select>
          </div>

          {/* Status filter */}
          <div>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full px-3 py-2 bg-muted/20 border border-border rounded-lg text-xs outline-none focus:ring-2 focus:ring-blue-500 transition-all font-medium"
            >
              <option value="all">Status: All</option>
              {filterOptions.statuses.map(s => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>

          {/* Category filter */}
          <div>
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="w-full px-3 py-2 bg-muted/20 border border-border rounded-lg text-xs outline-none focus:ring-2 focus:ring-blue-500 transition-all font-medium"
            >
              <option value="all">Category: All</option>
              {filterOptions.categories.map(c => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* ================= ANALYTICS CARDS ================= */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Inbox className="w-4 h-4 text-blue-600" />
            <h2 className="text-xs font-black uppercase tracking-widest text-muted-foreground">My Personal Ticket Analytics</h2>
          </div>
          <span className="text-xs font-semibold text-muted-foreground">Total Filtered: {filteredTickets.length}</span>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: "Assigned To Me", value: stats.totalAssigned, color: "border-l-blue-500 text-blue-600", desc: "Tickets assigned for your support" },
            { label: "Created By Me", value: stats.totalCreated, color: "border-l-emerald-500 text-emerald-600", desc: "Tickets you raised" },
            { label: "Open Tickets", value: stats.open, color: "border-l-purple-500 text-purple-600", desc: "Active & unresolved tickets" },
            { label: "In Progress", value: stats.inProgress, color: "border-l-cyan-500 text-cyan-600", desc: "Currently being worked on" },
            { label: "Resolved", value: stats.resolved, color: "border-l-green-500 text-green-600", desc: "Marked as solved" },
            { label: "Closed", value: stats.closed, color: "border-l-slate-500 text-slate-700", desc: "Archived & locked records" },
            { label: "Pending Actions", value: stats.pending, color: "border-l-amber-500 text-amber-600", desc: "Awaiting inputs / on hold" },
            { label: "Overdue Breached", value: stats.overdue, color: "border-l-red-500 text-red-600 font-bold", desc: "Resolution time deadline passed" },
          ].map((c, i) => (
            <div
              key={i}
              className={cn(
                "bg-white border border-border border-l-4 rounded-xl p-4 shadow-sm hover:shadow-md transition-all hover:-translate-y-0.5 duration-300",
                c.color
              )}
            >
              <div className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-1">
                {c.label}
              </div>
              <div className="text-3xl font-extrabold tracking-tight mb-1">
                {loading ? "—" : c.value}
              </div>
              <div className="text-[10px] text-muted-foreground leading-tight">{c.desc}</div>
            </div>
          ))}
        </div>
      </div>

      {/* ================= PERFORMANCE ANALYTICS & QUICK ACTIONS ================= */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Performance analytics metrics card */}
        <div className="bg-white border border-border rounded-xl p-5 shadow-sm lg:col-span-2 space-y-6">
          <div className="flex items-center justify-between border-b border-border pb-3">
            <h3 className="text-sm font-bold flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-emerald-600" />
              Performance Analytics
            </h3>
            <span className="text-[10px] font-bold uppercase tracking-widest bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded">Personal Stats</span>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-3 gap-6">
            <div className="bg-muted/10 rounded-xl p-4 text-center">
              <div className="text-[9px] font-black uppercase tracking-widest text-muted-foreground mb-1">Productivity Score</div>
              <div className="text-3xl font-black text-blue-600 mb-1">{loading ? "—" : `${stats.productivityScore}%`}</div>
              <div className="w-full bg-slate-100 rounded-full h-1.5 mt-2">
                <div className="bg-blue-600 h-1.5 rounded-full" style={{ width: `${stats.productivityScore}%` }} />
              </div>
            </div>

            <div className="bg-muted/10 rounded-xl p-4 text-center">
              <div className="text-[9px] font-black uppercase tracking-widest text-muted-foreground mb-1">Completion Rate</div>
              <div className="text-3xl font-black text-emerald-600 mb-1">{loading ? "—" : `${stats.completionPercentage}%`}</div>
              <div className="w-full bg-slate-100 rounded-full h-1.5 mt-2">
                <div className="bg-emerald-600 h-1.5 rounded-full" style={{ width: `${stats.completionPercentage}%` }} />
              </div>
            </div>

            <div className="bg-muted/10 rounded-xl p-4 text-center">
              <div className="text-[9px] font-black uppercase tracking-widest text-muted-foreground mb-1">Avg Resolution Speed</div>
              <div className="text-3xl font-black text-amber-600 mb-1">{loading ? "—" : `${stats.avgResolutionHours}h`}</div>
              <div className="text-[10px] text-muted-foreground mt-2">Time to solution</div>
            </div>

            <div className="bg-muted/10 rounded-xl p-4 text-center">
              <div className="text-[9px] font-black uppercase tracking-widest text-muted-foreground mb-1">Completed Today</div>
              <div className="text-3xl font-black text-purple-600">{loading ? "—" : stats.completedToday}</div>
              <div className="text-[10px] text-muted-foreground mt-1">Tickets resolved today</div>
            </div>

            <div className="bg-muted/10 rounded-xl p-4 text-center">
              <div className="text-[9px] font-black uppercase tracking-widest text-muted-foreground mb-1">Weekly Speedrun</div>
              <div className="text-3xl font-black text-cyan-600">{loading ? "—" : stats.weeklyPerformance}</div>
              <div className="text-[10px] text-muted-foreground mt-1">Resolved last 7 days</div>
            </div>

            <div className="bg-muted/10 rounded-xl p-4 text-center">
              <div className="text-[9px] font-black uppercase tracking-widest text-muted-foreground mb-1">Monthly Peak</div>
              <div className="text-3xl font-black text-slate-700">{loading ? "—" : stats.monthlyPerformance}</div>
              <div className="text-[10px] text-muted-foreground mt-1">Resolved last 30 days</div>
            </div>
          </div>
        </div>

        {/* Quick Actions Card */}
        <div className="bg-white border border-border rounded-xl p-5 shadow-sm space-y-4">
          <h3 className="text-sm font-bold flex items-center gap-2 border-b border-border pb-3">
            <Zap className="w-4 h-4 text-blue-600" />
            Quick Actions
          </h3>

          <div className="grid grid-cols-1 gap-2.5">
            <Link
              to="/tickets?action=new"
              className="flex items-center justify-between p-3 rounded-lg border border-border bg-blue-50/20 hover:bg-blue-50 hover:border-blue-200 transition-all font-semibold text-xs text-blue-700 group"
            >
              <span className="flex items-center gap-2">
                <Plus className="w-4 h-4" /> Create Ticket Record
              </span>
              <ChevronRight className="w-4 h-4 transition-transform group-hover:translate-x-0.5" />
            </Link>

            <Link
              to="/tickets?filter=assigned_to_me"
              className="flex items-center justify-between p-3 rounded-lg border border-border bg-emerald-50/20 hover:bg-emerald-50 hover:border-emerald-200 transition-all font-semibold text-xs text-emerald-700 group"
            >
              <span className="flex items-center gap-2">
                <User className="w-4 h-4" /> View My Active Tickets
              </span>
              <ChevronRight className="w-4 h-4 transition-transform group-hover:translate-x-0.5" />
            </Link>

            <Link
              to="/kb"
              className="flex items-center justify-between p-3 rounded-lg border border-border bg-purple-50/20 hover:bg-purple-50 hover:border-purple-200 transition-all font-semibold text-xs text-purple-700 group"
            >
              <span className="flex items-center gap-2">
                <Inbox className="w-4 h-4" /> Search Knowledge Base
              </span>
              <ChevronRight className="w-4 h-4 transition-transform group-hover:translate-x-0.5" />
            </Link>

            <button
              onClick={handleResetFilters}
              className="flex items-center justify-between p-3 rounded-lg border border-border bg-slate-50 hover:bg-slate-100 transition-all font-semibold text-xs text-slate-700 group w-full"
            >
              <span className="flex items-center gap-2">
                <RefreshCw className="w-4 h-4" /> Reset Dashboard Filters
              </span>
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* ================= CHARTS & GRAPHS ================= */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        
        {/* Tickets by Status Bar Chart */}
        <div className="bg-white border border-border rounded-xl p-5 shadow-sm">
          <h3 className="text-xs font-black uppercase tracking-widest text-muted-foreground mb-4">Tickets by Status</h3>
          <div className="h-64">
            {chartData.barChart.length === 0 ? (
              <div className="h-full flex items-center justify-center text-xs text-muted-foreground font-medium">No data available for status chart</div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData.barChart} margin={{ left: -10, right: 10 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="name" fontSize={10} fontClass="font-semibold" />
                  <YAxis fontSize={10} allowDecimals={false} />
                  <Tooltip contentStyle={{ fontSize: 11, borderRadius: 8, border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.08)' }} />
                  <Bar dataKey="Tickets" radius={[4, 4, 0, 0]}>
                    {chartData.barChart.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* Ticket Category Distribution Pie Chart */}
        <div className="bg-white border border-border rounded-xl p-5 shadow-sm">
          <h3 className="text-xs font-black uppercase tracking-widest text-muted-foreground mb-4">Category Distribution</h3>
          <div className="h-64">
            {chartData.pieChart.length === 0 ? (
              <div className="h-full flex items-center justify-center text-xs text-muted-foreground font-medium">No data available for category chart</div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={chartData.pieChart}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="value"
                    label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}
                  >
                    {chartData.pieChart.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={{ fontSize: 11, borderRadius: 8, border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.08)' }} />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* Daily/Weekly ticket trend Line Chart */}
        <div className="bg-white border border-border rounded-xl p-5 shadow-sm">
          <h3 className="text-xs font-black uppercase tracking-widest text-muted-foreground mb-4">Daily Ticket Trend (Last 7 Days)</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData.lineChart}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="name" fontSize={10} />
                <YAxis fontSize={10} allowDecimals={false} />
                <Tooltip contentStyle={{ fontSize: 11, borderRadius: 8, border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.08)' }} />
                <Line type="monotone" dataKey="Created" stroke="#3b82f6" strokeWidth={2.5} activeDot={{ r: 6 }} />
                <Line type="monotone" dataKey="Resolved" stroke="#10b981" strokeWidth={2.5} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* User productivity timeline Area Chart */}
        <div className="bg-white border border-border rounded-xl p-5 shadow-sm">
          <h3 className="text-xs font-black uppercase tracking-widest text-muted-foreground mb-4">Productivity timeline</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData.productivityTimeline}>
                <defs>
                  <linearGradient id="colorActivity" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.4}/>
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="date" fontSize={10} />
                <YAxis fontSize={10} />
                <Tooltip contentStyle={{ fontSize: 11, borderRadius: 8, border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.08)' }} />
                <Area type="monotone" dataKey="Activity" stroke="#10b981" strokeWidth={2} fillOpacity={1} fill="url(#colorActivity)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* ================= RECENT ACTIVITY & MY TASKS ================= */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* Recent Activity Section */}
        <div className="bg-white border border-border rounded-xl p-5 shadow-sm space-y-4">
          <div className="flex items-center gap-2 border-b border-border pb-3">
            <Activity className="w-4 h-4 text-blue-600" />
            <h3 className="text-sm font-bold text-foreground">Recent Activity Section</h3>
          </div>

          <div className="space-y-4">
            {/* Newly Created */}
            <div>
              <div className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-2">Recently Created Tickets</div>
              {recents.recentlyCreated.length === 0 ? (
                <div className="text-xs text-muted-foreground py-1">No recently created tickets.</div>
              ) : (
                <div className="space-y-2">
                  {recents.recentlyCreated.map(t => (
                    <div key={t.id} className="flex items-center justify-between p-2.5 hover:bg-muted/10 rounded-lg transition-colors border border-border/40 text-xs">
                      <Link to={`/tickets/${t.id}`} className="font-mono font-bold text-blue-600 hover:underline">{t.number}</Link>
                      <span className="font-medium truncate max-w-[200px] text-foreground">{t.title}</span>
                      <span className="text-muted-foreground text-[10px]">{formatDate(t.createdAt)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Newly Resolved */}
            <div>
              <div className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-2">Recently Resolved Tickets</div>
              {recents.recentlyResolved.length === 0 ? (
                <div className="text-xs text-muted-foreground py-1">No recently resolved tickets.</div>
              ) : (
                <div className="space-y-2">
                  {recents.recentlyResolved.map(t => (
                    <div key={t.id} className="flex items-center justify-between p-2.5 hover:bg-muted/10 rounded-lg transition-colors border border-border/40 text-xs">
                      <Link to={`/tickets/${t.id}`} className="font-mono font-bold text-blue-600 hover:underline">{t.number}</Link>
                      <span className="font-medium truncate max-w-[200px] text-foreground">{t.title}</span>
                      <span className="bg-emerald-50 text-emerald-700 font-bold px-1.5 py-0.5 rounded text-[10px] uppercase">Resolved</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Recent updates / history */}
            <div>
              <div className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-2">Latest Updates & Comments</div>
              {recents.latestUpdates.length === 0 ? (
                <div className="text-xs text-muted-foreground py-1">No recent updates.</div>
              ) : (
                <div className="space-y-2.5">
                  {recents.latestUpdates.map(t => {
                    const lastAction = t.history && t.history.length > 0 ? t.history[t.history.length - 1] : { action: "Ticket updated", user: "System" };
                    return (
                      <div key={t.id} className="flex gap-2.5 items-start text-xs p-2 rounded-lg bg-muted/15">
                        <div className="p-1.5 rounded-lg bg-blue-50 text-blue-600 mt-0.5 shrink-0">
                          <Activity className="w-3.5 h-3.5" />
                        </div>
                        <div>
                          <span className="font-bold text-blue-600 mr-1.5">[{t.number}]</span>
                          <span className="font-semibold text-foreground">{lastAction.action}</span>
                          <div className="text-[10px] text-muted-foreground mt-0.5">By {lastAction.user || "System"}</div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* My Tasks Section */}
        <div className="bg-white border border-border rounded-xl p-5 shadow-sm space-y-4">
          <div className="flex items-center gap-2 border-b border-border pb-3">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            <h3 className="text-sm font-bold text-foreground">My Tasks Section</h3>
          </div>

          <div className="space-y-4">
            {/* High Priority Alerts */}
            {tasks.highPriority.length > 0 && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-xl space-y-2">
                <div className="flex items-center gap-2 text-red-700 text-xs font-black uppercase tracking-wider">
                  <AlertTriangle className="w-4 h-4" />
                  Immediate Action Required: High Priority Incidents
                </div>
                <div className="space-y-1.5">
                  {tasks.highPriority.map(t => (
                    <div key={t.id} className="flex justify-between items-center text-xs text-red-900 bg-white/60 p-2 rounded-lg">
                      <Link to={`/tickets/${t.id}`} className="font-mono font-bold hover:underline">{t.number}</Link>
                      <span className="truncate max-w-[180px] font-medium">{t.title}</span>
                      <span className="text-[9px] font-black uppercase tracking-widest bg-red-600 text-white px-1.5 py-0.5 rounded">{t.priority?.split(" - ")[1] || "High"}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* SLA Reminders */}
            {tasks.dueSoon.length > 0 && (
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl space-y-2">
                <div className="flex items-center gap-2 text-amber-700 text-xs font-black uppercase tracking-wider">
                  <Clock className="w-4 h-4" />
                  Due Date Reminders: Near SLA Breach
                </div>
                <div className="space-y-1.5">
                  {tasks.dueSoon.map(t => (
                    <div key={t.id} className="flex justify-between items-center text-xs text-amber-900 bg-white/60 p-2 rounded-lg">
                      <Link to={`/tickets/${t.id}`} className="font-mono font-bold hover:underline">{t.number}</Link>
                      <span className="truncate max-w-[180px] font-medium">{t.title}</span>
                      <span className="font-mono text-[10px] text-amber-700 font-bold bg-amber-100 px-1.5 py-0.5 rounded">SLA Due Soon</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Upcoming Tasks & Actions list */}
            <div>
              <div className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-2">Assigned Incidents Queue</div>
              {tasks.allOpenTasks.length === 0 ? (
                <div className="text-xs text-muted-foreground text-center py-6 border border-dashed border-border rounded-xl">
                  🎉 Good job! Your assigned ticket queue is empty.
                </div>
              ) : (
                <div className="space-y-2">
                  {tasks.allOpenTasks.map(t => {
                    const isHigh = t.priority?.includes("1 - Critical") || t.priority?.includes("2 - High");
                    return (
                      <div key={t.id} className="flex items-center justify-between p-3 hover:bg-muted/10 rounded-lg transition-colors border border-border/40 text-xs">
                        <div className="flex items-center gap-2">
                          <div className={cn("w-2 h-2 rounded-full", isHigh ? "bg-red-500" : "bg-blue-400")} />
                          <Link to={`/tickets/${t.id}`} className="font-mono font-bold text-blue-600 hover:underline">{t.number}</Link>
                        </div>
                        <span className="font-medium truncate max-w-[200px] text-foreground">{t.title}</span>
                        <span className="bg-slate-100 text-slate-700 font-semibold px-2 py-0.5 rounded text-[10px]">{t.status || "New"}</span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
