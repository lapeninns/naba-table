import React, { useState, useEffect, useMemo } from 'react';
import {
    X,
    Users,
    Clock,
    Calendar,
    Phone,
    Mail,
    MapPin,
    ChevronRight,
    MoreHorizontal,
    Copy,
    Check,
    Utensils,
    AlertCircle,
    Search,
    Filter,
    ArrowRight,
    Sparkles,
    MessageSquare,
    AlertTriangle,
    Armchair
} from 'lucide-react';

// --- MOCK DATA ---

const MOCK_GUEST = {
    id: "gst_123",
    firstName: "Sarah",
    lastName: "Connor",
    email: "sarah.c@example.com",
    phone: "+1 (555) 012-3456",
    avatar: "https://i.pravatar.cc/150?u=sarah",
    isVip: true,
    tags: ["VIP", "Nut Allergy", "Anniversary"],
    visits: 12,
    spend: 4500,
    lastVisit: "2 weeks ago"
};

const MOCK_BOOKING = {
    id: "bk_987654",
    guest: MOCK_GUEST,
    status: "confirmed", // confirmed, seated, cancelled, late
    date: "2024-10-24",
    startTime: "19:30",
    endTime: "21:30",
    partySize: 4,
    notes: "Prefers window seat. Anniversary celebration.",
    source: "OpenTable",
    occasion: "Anniversary",
    assignedTables: [] as string[]
};

const MOCK_TABLES = [
    { id: "t1", name: "101", capacity: 2, section: "Main Hall", type: "standard", status: "occupied" },
    { id: "t2", name: "102", capacity: 2, section: "Main Hall", type: "window", status: "available" },
    { id: "t3", name: "103", capacity: 4, section: "Main Hall", type: "standard", status: "available" },
    { id: "t4", name: "104", capacity: 4, section: "Main Hall", type: "booth", status: "conflicted", conflictTime: "19:00 - 20:00" },
    { id: "t5", name: "105", capacity: 6, section: "Main Hall", type: "large", status: "available" },
    { id: "t6", name: "201", capacity: 2, section: "Patio", type: "outdoor", status: "available" },
    { id: "t7", name: "202", capacity: 4, section: "Patio", type: "outdoor", status: "available" },
    { id: "t8", name: "301", capacity: 8, section: "Private", type: "private", status: "available" },
];

// --- UTILS ---

const getStatusColor = (status: string) => {
    switch (status) {
        case 'confirmed': return 'bg-blue-500 text-blue-50 border-blue-200';
        case 'seated': return 'bg-emerald-500 text-emerald-50 border-emerald-200';
        case 'late': return 'bg-rose-500 text-rose-50 border-rose-200';
        case 'cancelled': return 'bg-slate-500 text-slate-50 border-slate-200';
        default: return 'bg-amber-500 text-amber-50 border-amber-200';
    }
};

const getStatusTheme = (status: string) => {
    switch (status) {
        case 'confirmed': return 'blue';
        case 'seated': return 'emerald';
        case 'late': return 'rose';
        case 'cancelled': return 'slate';
        default: return 'amber';
    }
};

// --- SHADCN UI SIMULATIONS ---

const Button = ({ children, variant = "default", size = "default", className = "", ...props }: any) => {
    const base = "inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50";
    const variants: any = {
        default: "bg-slate-900 text-white hover:bg-slate-900/90 shadow",
        destructive: "bg-red-500 text-white hover:bg-red-500/90 shadow-sm",
        outline: "border border-slate-200 bg-white shadow-sm hover:bg-slate-100 text-slate-900",
        secondary: "bg-slate-100 text-slate-900 shadow-sm hover:bg-slate-100/80",
        ghost: "hover:bg-slate-100 hover:text-slate-900",
        link: "text-slate-900 underline-offset-4 hover:underline",
    };
    const sizes: any = {
        default: "h-9 px-4 py-2",
        sm: "h-8 rounded-md px-3 text-xs",
        lg: "h-10 rounded-md px-8",
        icon: "h-9 w-9",
    };
    return (
        <button className={`${base} ${variants[variant]} ${sizes[size]} ${className}`} {...props}>
            {children}
        </button>
    );
};

const Badge = ({ children, variant = "default", className = "" }: any) => {
    const base = "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2";
    const variants: any = {
        default: "border-transparent bg-slate-900 text-white hover:bg-slate-900/80",
        secondary: "border-transparent bg-slate-100 text-slate-900 hover:bg-slate-100/80",
        destructive: "border-transparent bg-red-500 text-white hover:bg-red-500/80",
        outline: "text-slate-950 border-slate-200",
        success: "border-transparent bg-emerald-500 text-white hover:bg-emerald-600",
        warning: "border-transparent bg-amber-500 text-white hover:bg-amber-600",
    };
    return <div className={`${base} ${variants[variant]} ${className}`}>{children}</div>;
};

const Tabs = ({ activeTab, onTabChange, tabs }: any) => {
    return (
        <div className="w-full">
            <div className="flex items-center border-b border-slate-200">
                {tabs.map((tab: any) => (
                    <button
                        key={tab.id}
                        onClick={() => onTabChange(tab.id)}
                        className={`flex items-center justify-center whitespace-nowrap px-4 py-2 text-sm font-medium transition-all ${activeTab === tab.id
                                ? "border-b-2 border-slate-900 text-slate-950"
                                : "text-slate-500 hover:text-slate-900"
                            }`}
                    >
                        {tab.label}
                    </button>
                ))}
            </div>
        </div>
    );
};

const Card = ({ children, className = "" }: any) => (
    <div className={`rounded-xl border border-slate-200 bg-white text-slate-950 shadow ${className}`}>
        {children}
    </div>
);

const Avatar = ({ src, fallback, className = "" }: any) => (
    <div className={`relative flex h-10 w-10 shrink-0 overflow-hidden rounded-full ${className}`}>
        <img className="aspect-square h-full w-full object-cover" src={src} alt="Avatar" />
    </div>
);

const Separator = ({ className = "" }: any) => (
    <div className={`shrink-0 bg-slate-200 h-[1px] w-full ${className}`} />
);

const ScrollArea = ({ children, className = "" }: any) => (
    <div className={`overflow-auto ${className}`}>{children}</div>
);

const Tooltip = ({ text, children }: any) => {
    const [show, setShow] = useState(false);
    return (
        <div className="relative flex items-center" onMouseEnter={() => setShow(true)} onMouseLeave={() => setShow(false)}>
            {children}
            {show && (
                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 bg-slate-900 text-white text-xs rounded z-50 whitespace-nowrap">
                    {text}
                </div>
            )}
        </div>
    );
};

// --- FEATURE COMPONENTS ---

const BookingStatusBadge = ({ status }: { status: string }) => {
    const colorClass = getStatusColor(status);
    return (
        <div className={`inline-flex items-center rounded-md border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 ${colorClass}`}>
            {status.charAt(0).toUpperCase() + status.slice(1)}
        </div>
    );
};

const ArrivalCountdown = ({ time }: { time: string }) => {
    return (
        <div className="flex items-center gap-1.5 text-sm font-medium text-amber-600 animate-pulse">
            <Clock className="w-4 h-4" />
            <span>Arrives in 15m</span>
        </div>
    );
};

const StatCard = ({ icon: Icon, label, value, subtext }: any) => (
    <div className="flex items-start gap-3 p-3 rounded-lg border border-slate-100 bg-slate-50/50">
        <div className="p-2 bg-white rounded-md shadow-sm border border-slate-100">
            <Icon className="w-4 h-4 text-slate-500" />
        </div>
        <div>
            <p className="text-xs font-medium text-slate-500">{label}</p>
            <div className="flex items-baseline gap-1">
                <p className="text-lg font-bold text-slate-900">{value}</p>
                {subtext && <p className="text-xs text-slate-400">{subtext}</p>}
            </div>
        </div>
    </div>
);

const ContactRow = ({ icon: Icon, value, actionLabel, onAction }: any) => (
    <div className="flex items-center justify-between py-2 group">
        <div className="flex items-center gap-3">
            <div className="p-1.5 rounded-md bg-slate-100 text-slate-500">
                <Icon className="w-4 h-4" />
            </div>
            <span className="text-sm font-medium text-slate-700">{value}</span>
        </div>
        {actionLabel && (
            <Button variant="ghost" size="sm" className="h-7 text-xs opacity-0 group-hover:opacity-100 transition-opacity" onClick={onAction}>
                {actionLabel}
            </Button>
        )}
    </div>
);

// --- COMPLEX COMPONENTS ---

const TimelineConflictBar = ({ conflictTime }: { conflictTime: string }) => {
    // Mock logic for visualization
    // Assuming context is 6pm - 10pm. 
    // Booking is 7:30 - 9:30.
    // Conflict is 7:00 - 8:00
    return (
        <div className="mt-2 w-full">
            <div className="flex justify-between text-[10px] text-slate-400 mb-1">
                <span>18:00</span>
                <span>22:00</span>
            </div>
            <div className="h-2 w-full bg-slate-100 rounded-full relative overflow-hidden">
                {/* Available Time Context */}

                {/* Current Booking Request (Blue) - 7:30 to 9:30 is 37.5% start, 50% width */}
                <div className="absolute top-0 h-full bg-blue-100 rounded-full" style={{ left: '37.5%', width: '50%' }}></div>

                {/* Conflicting Booking (Red) - 7:00 to 8:00 is 25% start, 25% width */}
                <div className="absolute top-0 h-full bg-red-400/80 rounded-full border-r border-white" style={{ left: '25%', width: '25%' }}></div>

                {/* Overlap Zone (Dark Red) - Purely visual trickery for this demo */}
                <div className="absolute top-0 h-full bg-red-600 rounded-full" style={{ left: '37.5%', width: '12.5%' }}></div>
            </div>
            <div className="flex justify-between text-[10px] mt-1">
                <span className="text-red-500 font-medium">Conflict: {conflictTime}</span>
            </div>
        </div>
    )
}

const SelectableTableCard = ({ table, isSelected, onToggle, partySize }: any) => {
    const isConflicted = table.status === 'conflicted';
    const isOccupied = table.status === 'occupied';
    const isDisabled = isOccupied;

    let stateStyles = "border-slate-200 bg-white hover:border-slate-300";
    if (isSelected) stateStyles = "border-blue-500 bg-blue-50 ring-1 ring-blue-500";
    else if (isConflicted) stateStyles = "border-amber-200 bg-amber-50/50";
    else if (isOccupied) stateStyles = "border-slate-100 bg-slate-100 opacity-60 cursor-not-allowed";

    const capacityFit = table.capacity >= partySize && table.capacity <= partySize + 2;

    return (
        <div
            onClick={() => !isDisabled && onToggle(table.id)}
            className={`relative p-3 rounded-lg border transition-all cursor-pointer ${stateStyles}`}
        >
            <div className="flex justify-between items-start mb-2">
                <div className="flex items-center gap-2">
                    <span className="text-lg font-bold text-slate-900">{table.name}</span>
                    <span className="text-xs text-slate-500 font-medium">{table.type}</span>
                </div>
                <div className="flex gap-1">
                    {capacityFit && <Badge variant="success" className="h-5 px-1.5 text-[10px]">Fit</Badge>}
                    <Badge variant="secondary" className="h-5 px-1.5 text-[10px] flex gap-1">
                        <Users className="w-3 h-3" /> {table.capacity}
                    </Badge>
                </div>
            </div>

            {isConflicted ? (
                <TimelineConflictBar conflictTime={table.conflictTime} />
            ) : (
                <div className="flex items-center gap-2 text-xs text-slate-500">
                    <div className={`w-2 h-2 rounded-full ${isOccupied ? 'bg-slate-400' : 'bg-emerald-400'}`} />
                    {isOccupied ? 'Occupied until 20:00' : 'Available'}
                </div>
            )}

            {isSelected && (
                <div className="absolute -top-2 -right-2 bg-blue-600 text-white rounded-full p-0.5 shadow-md">
                    <Check className="w-3 h-3" />
                </div>
            )}
        </div>
    );
};

const TableAssignmentPanel = ({ assignedTables, onAssignToggle, partySize }: any) => {
    const [filter, setFilter] = useState('all'); // all, available, fit
    const [sectionFilter, setSectionFilter] = useState('All');

    const filteredTables = useMemo(() => {
        return MOCK_TABLES.filter(t => {
            if (sectionFilter !== 'All' && t.section !== sectionFilter) return false;
            if (filter === 'available' && t.status !== 'available') return false;
            if (filter === 'fit' && t.capacity < partySize) return false;
            return true;
        });
    }, [filter, sectionFilter, partySize]);

    // Group by section
    const sections = Array.from(new Set(filteredTables.map(t => t.section)));

    return (
        <div className="flex flex-col h-full">
            {/* Controls */}
            <div className="flex flex-col gap-3 p-1 pb-4">
                <div className="flex items-center justify-between">
                    <h3 className="text-sm font-semibold text-slate-900">Select Tables</h3>
                    <div className="flex gap-1">
                        <Button
                            variant="outline"
                            size="sm"
                            className="h-7 text-xs gap-1"
                            onClick={() => {
                                // Magic assign logic mock
                                const best = MOCK_TABLES.find(t => t.status === 'available' && t.capacity >= partySize);
                                if (best) onAssignToggle(best.id);
                            }}
                        >
                            <Sparkles className="w-3 h-3 text-amber-500" />
                            Smart Assign
                        </Button>
                    </div>
                </div>

                <div className="flex items-center gap-2 overflow-x-auto pb-1 hide-scrollbar">
                    {['All', 'Main Hall', 'Patio', 'Private'].map(s => (
                        <button
                            key={s}
                            onClick={() => setSectionFilter(s)}
                            className={`px-3 py-1 text-xs rounded-full border transition-colors whitespace-nowrap ${sectionFilter === s ? 'bg-slate-800 text-white border-slate-800' : 'bg-white text-slate-600 border-slate-200'}`}
                        >
                            {s}
                        </button>
                    ))}
                </div>
            </div>

            {/* Grid */}
            <ScrollArea className="flex-1 pr-2 -mr-2">
                <div className="space-y-6">
                    {sections.map(section => (
                        <div key={section}>
                            <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3 pl-1">{section}</h4>
                            <div className="grid grid-cols-2 gap-3">
                                {filteredTables.filter(t => t.section === section).map(table => (
                                    <SelectableTableCard
                                        key={table.id}
                                        table={table}
                                        partySize={partySize}
                                        isSelected={assignedTables.includes(table.id)}
                                        onToggle={onAssignToggle}
                                    />
                                ))}
                            </div>
                        </div>
                    ))}
                </div>
            </ScrollArea>

            {/* Footer Summary */}
            <div className="mt-4 pt-4 border-t border-slate-100 bg-white/50 backdrop-blur-sm">
                <div className="flex justify-between items-center text-sm mb-3">
                    <span className="text-slate-500">Selected Capacity:</span>
                    <span className={`font-bold ${assignedTables.length > 0 ? 'text-slate-900' : 'text-slate-400'}`}>
                        {assignedTables.reduce((acc: number, id: string) => acc + (MOCK_TABLES.find(t => t.id === id)?.capacity || 0), 0)} / {partySize} Guests
                    </span>
                </div>
                {assignedTables.some((id: string) => MOCK_TABLES.find(t => t.id === id)?.status === 'conflicted') && (
                    <div className="mb-3 flex items-start gap-2 p-2 bg-amber-50 text-amber-700 rounded-md text-xs border border-amber-100">
                        <AlertTriangle className="w-4 h-4 shrink-0" />
                        <p>Warning: You selected a conflicted table. Manager approval required.</p>
                    </div>
                )}
            </div>
        </div>
    );
};

// --- SUB-SECTIONS OF DIALOG ---

const GuestProfilePanel = ({ guest }: any) => (
    <div className="flex flex-col gap-6">
        <div className="flex items-start gap-4">
            <div className="relative">
                <Avatar src={guest.avatar} className="w-16 h-16 border-2 border-white shadow-sm" />
                {guest.isVip && (
                    <div className="absolute -bottom-1 -right-1 bg-amber-400 text-white p-1 rounded-full border-2 border-white" title="VIP Guest">
                        <Sparkles className="w-3 h-3" />
                    </div>
                )}
            </div>
            <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                    <h2 className="text-xl font-bold text-slate-900 truncate">{guest.firstName} {guest.lastName}</h2>
                </div>
                <div className="flex flex-wrap gap-1.5 mb-2">
                    {guest.tags.map((tag: string) => (
                        <Badge key={tag} variant="outline" className={`text-[10px] h-5 ${tag === 'VIP' ? 'bg-amber-50 text-amber-700 border-amber-200' : 'bg-slate-50'}`}>
                            {tag}
                        </Badge>
                    ))}
                </div>
                <div className="flex items-center gap-4 text-xs text-slate-500">
                    <span>{guest.visits} visits</span>
                    <span className="w-1 h-1 rounded-full bg-slate-300" />
                    <span>${guest.spend} total spend</span>
                </div>
            </div>
        </div>

        <Separator />

        <div className="space-y-1">
            <ContactRow icon={Phone} value={guest.phone} actionLabel="Call" />
            <ContactRow icon={Mail} value={guest.email} actionLabel="Email" />
            <ContactRow icon={MessageSquare} value="Whatsapp Available" actionLabel="Chat" />
        </div>

        <div className="grid grid-cols-2 gap-3">
            <StatCard icon={Calendar} label="Last Visit" value="14d" subtext="ago" />
            <StatCard icon={Utensils} label="Avg Spend" value="$375" subtext="per visit" />
        </div>

        {/* Notes Section */}
        <div className="bg-amber-50/50 rounded-lg p-3 border border-amber-100">
            <div className="flex items-center gap-2 mb-2 text-amber-800">
                <MessageSquare className="w-4 h-4" />
                <span className="text-sm font-semibold">Booking Notes</span>
            </div>
            <p className="text-sm text-slate-700 leading-relaxed">
                "Prefers a quiet corner if possible. Celebrating 5th anniversary. Allergic to shellfish."
            </p>
        </div>
    </div>
);

// --- MAIN DIALOG COMPONENT ---

const BookingDialog = ({ isOpen, onClose, booking }: any) => {
    const [assignedTables, setAssignedTables] = useState < string[] > (booking.assignedTables);
    const [status, setStatus] = useState(booking.status);
    const themeColor = getStatusTheme(status);

    // Keyboard Shortcuts
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (!isOpen) return;
            if (e.key === 'Escape') onClose();
            if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
                // Simulate save/assign
                console.log("Saving...");
                onClose();
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isOpen, onClose]);

    if (!isOpen) return null;

    const handleTableToggle = (tableId: string) => {
        setAssignedTables(prev =>
            prev.includes(tableId)
                ? prev.filter(id => id !== tableId)
                : [...prev, tableId]
        );
    };

    const borderColor = {
        blue: 'border-t-blue-500',
        emerald: 'border-t-emerald-500',
        amber: 'border-t-amber-500',
        rose: 'border-t-rose-500',
        slate: 'border-t-slate-500'
    }[themeColor];

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
            <div
                className={`bg-white rounded-xl shadow-2xl w-full max-w-5xl h-[85vh] flex flex-col overflow-hidden border-t-4 ${borderColor}`}
                role="dialog"
            >
                {/* --- HEADER --- */}
                <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between shrink-0 bg-slate-50/30">
                    <div className="flex items-center gap-4">
                        <div className="flex flex-col">
                            <div className="flex items-center gap-3">
                                <h1 className="text-lg font-bold text-slate-900">Booking Details</h1>
                                <span className="text-slate-300">|</span>
                                <span className="font-mono text-sm text-slate-500">#{booking.id}</span>
                                <BookingStatusBadge status={status} />
                            </div>
                            <div className="flex items-center gap-4 mt-1 text-sm text-slate-500">
                                <span className="flex items-center gap-1.5"><Calendar className="w-3.5 h-3.5" /> {booking.date}</span>
                                <span className="flex items-center gap-1.5"><Clock className="w-3.5 h-3.5" /> {booking.startTime} - {booking.endTime}</span>
                                <span className="flex items-center gap-1.5"><Users className="w-3.5 h-3.5" /> {booking.partySize} Guests</span>
                            </div>
                        </div>
                    </div>

                    <div className="flex items-center gap-4">
                        <ArrivalCountdown time={booking.startTime} />
                        <div className="h-8 w-[1px] bg-slate-200 mx-2" />
                        <Button variant="ghost" size="icon" onClick={onClose} className="rounded-full hover:bg-slate-200/50">
                            <X className="w-5 h-5 text-slate-500" />
                        </Button>
                    </div>
                </div>

                {/* --- BODY --- */}
                <div className="flex flex-1 min-h-0">
                    {/* Left Panel: Guest & Booking Info */}
                    <div className="w-[380px] shrink-0 border-r border-slate-100 p-6 overflow-y-auto bg-white">
                        <GuestProfilePanel guest={booking.guest} />
                    </div>

                    {/* Right Panel: Table Assignment */}
                    <div className="flex-1 flex flex-col min-w-0 bg-slate-50/50">
                        <div className="p-6 h-full overflow-hidden flex flex-col">
                            <div className="flex items-center justify-between mb-4">
                                <h3 className="font-semibold text-slate-900 flex items-center gap-2">
                                    <Armchair className="w-4 h-4 text-slate-500" />
                                    Table Assignment
                                </h3>
                                <div className="flex gap-2">
                                    {/* View toggle could go here */}
                                </div>
                            </div>

                            <div className="flex-1 min-h-0 bg-white rounded-xl border border-slate-200 shadow-sm p-4">
                                <TableAssignmentPanel
                                    assignedTables={assignedTables}
                                    onAssignToggle={handleTableToggle}
                                    partySize={booking.partySize}
                                />
                            </div>
                        </div>
                    </div>
                </div>

                {/* --- FOOTER --- */}
                <div className="p-4 border-t border-slate-100 bg-white shrink-0 flex items-center justify-between">
                    <div className="flex items-center gap-4 text-sm text-slate-500">
                        <Tooltip text="Copy Summary">
                            <Button variant="ghost" size="sm" className="gap-2">
                                <Copy className="w-4 h-4" />
                                <span className="hidden sm:inline">Copy Details</span>
                            </Button>
                        </Tooltip>
                    </div>

                    <div className="flex items-center gap-3">
                        <Button variant="outline" onClick={onClose}>
                            Cancel
                        </Button>
                        <Button
                            variant={status === 'checked_in' ? 'success' : 'default'}
                            className="min-w-[140px]"
                            disabled={assignedTables.length === 0}
                            onClick={() => {
                                setStatus('seated');
                                // Simulation of assign
                            }}
                        >
                            {status === 'seated' ? 'Update Allocation' : 'Check In & Assign'}
                        </Button>
                    </div>
                </div>
            </div>
        </div>
    );
};

// --- APP ROOT (DEMO DASHBOARD) ---

export default function BookingSystemDemo() {
    const [isDialogOpen, setIsDialogOpen] = useState(false);

    return (
        <div className="min-h-screen bg-slate-50 font-sans text-slate-900 flex flex-col">
            {/* Mock Dashboard Header */}
            <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-6 sticky top-0 z-10">
                <div className="flex items-center gap-8">
                    <div className="flex items-center gap-2 font-bold text-xl tracking-tight text-indigo-600">
                        <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center text-white">
                            <Utensils className="w-5 h-5" />
                        </div>
                        TableOS
                    </div>
                    <nav className="hidden md:flex items-center gap-1">
                        <Button variant="ghost" className="text-slate-600">Floor Plan</Button>
                        <Button variant="secondary" className="bg-indigo-50 text-indigo-700">Bookings</Button>
                        <Button variant="ghost" className="text-slate-600">Guests</Button>
                    </nav>
                </div>
                <div className="flex items-center gap-4">
                    <Button variant="outline" size="sm" className="gap-2">
                        <Search className="w-4 h-4" />
                        <span className="hidden sm:inline">Search...</span>
                    </Button>
                    <Avatar src="https://i.pravatar.cc/150?u=admin" className="w-8 h-8" />
                </div>
            </header>

            {/* Mock Dashboard Content */}
            <main className="flex-1 p-8">
                <div className="max-w-7xl mx-auto">
                    <div className="flex items-center justify-between mb-8">
                        <div>
                            <h1 className="text-2xl font-bold text-slate-900">Today's Service</h1>
                            <p className="text-slate-500">Thursday, Oct 24 • Dinner Service</p>
                        </div>
                        <div className="flex gap-3">
                            <Button variant="outline">
                                <Filter className="w-4 h-4 mr-2" />
                                Filters
                            </Button>
                            <Button className="bg-indigo-600 hover:bg-indigo-700">
                                New Booking
                            </Button>
                        </div>
                    </div>

                    {/* Dashboard Grid */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                        <Card className="p-6 flex items-center gap-4 bg-gradient-to-br from-indigo-500 to-indigo-600 text-white border-0 shadow-lg">
                            <div className="p-3 bg-white/20 rounded-lg backdrop-blur-sm">
                                <Users className="w-6 h-6" />
                            </div>
                            <div>
                                <p className="text-indigo-100 text-sm font-medium">Total Covers</p>
                                <p className="text-3xl font-bold">142</p>
                            </div>
                        </Card>
                        <Card className="p-6 flex items-center gap-4">
                            <div className="p-3 bg-emerald-100 text-emerald-600 rounded-lg">
                                <Check className="w-6 h-6" />
                            </div>
                            <div>
                                <p className="text-slate-500 text-sm font-medium">Checked In</p>
                                <p className="text-3xl font-bold text-slate-900">48</p>
                            </div>
                        </Card>
                        <Card className="p-6 flex items-center gap-4">
                            <div className="p-3 bg-amber-100 text-amber-600 rounded-lg">
                                <Clock className="w-6 h-6" />
                            </div>
                            <div>
                                <p className="text-slate-500 text-sm font-medium">Pending Arrival</p>
                                <p className="text-3xl font-bold text-slate-900">12</p>
                            </div>
                        </Card>
                    </div>

                    {/* Booking List Mock */}
                    <Card className="overflow-hidden">
                        <div className="p-4 border-b border-slate-100 bg-slate-50 flex items-center justify-between">
                            <h3 className="font-semibold text-slate-900">Upcoming Arrivals</h3>
                        </div>
                        <div className="divide-y divide-slate-100">
                            {/* The Trigger Row */}
                            <div
                                onClick={() => setIsDialogOpen(true)}
                                className="p-4 flex items-center justify-between hover:bg-slate-50 cursor-pointer transition-colors group"
                            >
                                <div className="flex items-center gap-4">
                                    <div className="font-mono text-sm font-medium text-slate-500 w-16">19:30</div>
                                    <div className="flex items-center gap-3">
                                        <Avatar src={MOCK_GUEST.avatar} />
                                        <div>
                                            <div className="font-semibold text-slate-900 flex items-center gap-2">
                                                Sarah Connor
                                                <Badge variant="warning" className="h-5 px-1.5 text-[10px]">VIP</Badge>
                                            </div>
                                            <div className="text-sm text-slate-500">Party of 4 • Anniversary</div>
                                        </div>
                                    </div>
                                </div>
                                <div className="flex items-center gap-6">
                                    <Badge variant="success">Confirmed</Badge>
                                    <div className="text-sm text-slate-400 group-hover:text-indigo-600 flex items-center gap-1 font-medium transition-colors">
                                        View Details <ArrowRight className="w-4 h-4" />
                                    </div>
                                </div>
                            </div>

                            {/* Filler Rows */}
                            {[1, 2, 3].map(i => (
                                <div key={i} className="p-4 flex items-center justify-between opacity-50 grayscale">
                                    <div className="flex items-center gap-4">
                                        <div className="font-mono text-sm font-medium text-slate-500 w-16">19:45</div>
                                        <div className="flex items-center gap-3">
                                            <div className="w-10 h-10 rounded-full bg-slate-200" />
                                            <div>
                                                <div className="font-semibold text-slate-900 bg-slate-200 h-4 w-32 rounded mb-1"></div>
                                                <div className="text-sm text-slate-500 bg-slate-200 h-3 w-24 rounded"></div>
                                            </div>
                                        </div>
                                    </div>
                                    <Badge variant="secondary">Pending</Badge>
                                </div>
                            ))}
                        </div>
                    </Card>
                </div>
            </main>

            {/* The Actual Feature Component */}
            <BookingDialog
                isOpen={isDialogOpen}
                onClose={() => setIsDialogOpen(false)}
                booking={MOCK_BOOKING}
            />
        </div>
    );
}