# Executive Summary: Temporal Capacity Deadlock Analysis

**Restaurant**: Prince of Wales Pub (Bromham)  
**Date**: 2025-11-09  
**Analysis Date**: 2025-11-04

---

## 🎯 **The Problem in One Sentence**

20 pending bookings cannot be assigned tables not because we lack tables (we have 40), but because 40 earlier-confirmed bookings have **monopolized every available time slot** at peak hours.

---

## 📊 **Key Finding: This is Temporal, Not Physical**

| Dimension             | Status                                    | Impact             |
| --------------------- | ----------------------------------------- | ------------------ |
| **Physical Capacity** | ✅ SUFFICIENT<br>40 tables, 210 seats     | Not the bottleneck |
| **Temporal Capacity** | ❌ EXHAUSTED<br>100% peak slot saturation | **ROOT CAUSE**     |

```
Analogy:
- We have 40 parking spaces (physical capacity) ✓
- But all 40 are occupied 12:00-13:30 and 18:00-20:00 (temporal monopolization) ✗
- New cars arrive during peak times → "No parking available"
- Even though parking lot has 40 spaces total
```

---

## 🔍 **The "Clean Sweep Conflict" Pattern**

Every single pending booking encounters **100% table conflicts**:

```
Party Size 3: Tried 14 tables → 14 blocked (100%)
Party Size 4: Tried 24 tables → 24 blocked (100%)
Party Size 6: Tried 16 tables → 16 blocked (100%)
Party Size 7: Tried 5 tables → 5 blocked (100%)
```

**This isn't random**—it's systematic monopolization of temporal capacity by confirmed bookings.

---

## 💡 **Why Traditional Solutions Won't Work**

### ❌ **"Add More Tables"**

- Won't help: Time slots already 100% monopolized
- New tables would also be blocked by early bookings
- Cost: High | Impact: Zero

### ❌ **"First-Come-First-Served"**

- Current problem: Early bookers monopolize all peak slots
- Creates temporal unfairness
- Cost: None | Impact: Negative (causes the deadlock)

### ⚠️ **"Manual Review" (Partial Solution)**

- Can help optimize suboptimal assignments
- Doesn't scale, requires constant intervention
- Cost: Staff time | Impact: Temporary

---

## ✅ **What Will Actually Work**

### **1. Fix Service Period Gap (Quick Win - 35% of failures)**

**Issue**: 7 bookings at 15:15-16:00 rejected (lunch ends at 15:00)

**Solution**:

- Extend lunch service to 16:30, OR
- Start dinner service at 15:00

**Impact**: Unlocks 7 bookings immediately  
**Effort**: Configuration change (1 hour)  
**Cost**: Minimal

---

### **2. Break Temporal Deadlock (High Impact - 65% of failures)**

**Issue**: 40 confirmed bookings monopolize 100% of peak time slots

**Solutions**:

#### **Option A: Optimize Existing Assignments**

- Audit 40 confirmed bookings for inefficiencies
- Example: Party of 2 holding 8-person table → move to 2-person table
- Frees larger tables for pending bookings

**Impact**: Could unlock 5-10 bookings  
**Effort**: 4-6 hours analyst time  
**Cost**: Staff time only

#### **Option B: Temporal Load Balancing**

- Offer confirmed customers incentives to shift ±30 minutes
- Example: Move 3 bookings from 18:15 → 17:45 or 18:45
- Opens temporal windows for pending bookings

**Impact**: Could unlock 8-13 bookings  
**Effort**: Customer outreach (2-3 hours)  
**Cost**: Discounts/incentives (~5-10% off check)

---

### **3. Prevent Future Deadlocks (Strategic)**

**Implement Temporal Capacity Monitoring**:

```
Metric: Temporal Availability Ratio (TAR)
Formula: TAR = Available table-time slots / Total table-time slots

Example:
- 18:15 has 14 suitable 4-person tables
- All 14 are held by confirmed bookings
- TAR = 0/14 = 0% → DEADLOCK ALERT

Thresholds:
- TAR > 30%: GREEN (healthy)
- TAR 10-30%: YELLOW (approaching saturation)
- TAR < 10%: RED (deadlock imminent)
- TAR = 0%: CRITICAL (complete monopolization)
```

**Impact**: Real-time visibility into temporal capacity  
**Effort**: Development (2-3 days)  
**Cost**: Engineering time

**Prevent Monopolization**:

- Limit bookings per 15-minute window (e.g., max 8 at 18:00)
- Reserve capacity for different party sizes
- Dynamic pricing based on temporal scarcity

**Impact**: Prevents 100% saturation before it happens  
**Effort**: Business rules + development (1 week)  
**Cost**: Engineering time + potential revenue opportunity (surge pricing)

---

## 📈 **Recommended Action Plan**

### **Phase 1: Immediate (This Week)**

1. ✅ Fix service period gap → **Unlocks 7 bookings** (35%)
2. ✅ Audit confirmed bookings for optimization → **Unlocks 5-10 bookings** (25-50%)

**Total Impact**: 12-17 of 20 pending bookings (60-85%)  
**Timeline**: 1 week  
**Cost**: Staff time only

---

### **Phase 2: Short-term (This Month)**

1. ✅ Implement temporal capacity monitoring (TAR metric)
2. ✅ Add time slot quotas to prevent future monopolization
3. ✅ Enable temporal load balancing (incentivize off-peak)

**Total Impact**: Prevents future deadlocks  
**Timeline**: 2-4 weeks  
**Cost**: ~40 engineering hours

---

### **Phase 3: Strategic (Next Quarter)**

1. ✅ Advanced conflict resolution engine
2. ✅ Dynamic pricing based on temporal scarcity
3. ✅ Predictive capacity forecasting

**Total Impact**: Optimize revenue + customer experience  
**Timeline**: 3 months  
**Cost**: ~200 engineering hours + ongoing monitoring

---

## 💰 **Business Impact**

### **Current State**

- 20 pending bookings = ~$2,000-4,000 in potential revenue (blocked)
- Customer experience: Frustration ("No tables available" despite visible empty tables)
- Staff time: Manual intervention required

### **After Phase 1**

- 12-17 bookings assigned = ~$1,200-3,400 revenue recovered
- Reduced manual intervention
- Timeline: 1 week

### **After Phase 2**

- Prevents future deadlocks = consistent revenue capture
- Real-time capacity visibility = better operational decisions
- Timeline: 1 month

---

## 🎓 **Key Insight for Leadership**

**Traditional capacity planning asks**: "Do we have enough tables?"  
**Answer**: Yes (40 tables, 210 seats)

**Temporal capacity planning asks**: "Do we have tables available **at this specific time**?"  
**Answer**: No (100% monopolized at peak hours)

**The shift**: From physical resources to **temporal resources** as the constraint.

This is a **resource allocation problem**, not a capacity problem. The solution isn't more tables—it's better **temporal distribution** of bookings across existing tables.

---

## 📞 **Next Steps**

1. **Immediate**: Approve service period extension (15 min decision)
2. **This Week**: Task analyst to audit 40 confirmed bookings for optimization
3. **This Month**: Prioritize temporal capacity monitoring in engineering backlog

**Questions?** Review full analysis: `reports/auto-assign-enhanced-analysis-2025-11-09.md`

---

_Analysis based on comprehensive diagnostic data from 60 bookings on 2025-11-09._
