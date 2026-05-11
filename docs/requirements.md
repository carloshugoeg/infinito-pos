# 🍓 MASTER PRODUCT REQUIREMENTS DOCUMENT (PRD): Koi POS v1

**Project Name:** Koi POS (Specialized for Chocolate-covered Strawberries and similar products)  
**Developer Agency:** Koi Software  
**Lead Architect:** Carlos Hugo Escobar Gómez  
**Core Vision:** "Strawberry-First, Architecture-Ready." A bespoke system for high-volume retail that scales into a universal multi-tenant SaaS.

---

## 1. PROJECT SCOPE & OBJECTIVES

* **Operational Goal:** Eliminate friction in high-customization ordering processes.
* **Technical Goal:** Build a modular ERP/POS hybrid using a **Recipe-Based** inventory model.
* **Scalability:** Ensure the code is **Product-Agnostic** (works for strawberries today; hardware, apparel, or pizza tomorrow).

---

## 2. FUNCTIONAL MODULES (THE 5 PILLARS)

### I. Dynamic Catalog & Product Constructor ("The Recipe Engine")

* **Composite Product Logic:** Products are treated as assemblies, not static SKUs.
* **Base Products:** Primary items (e.g., Small Cup @ Q25, Large Box @ Q60).
* **Modifier Groups:**
  * **Mandatory (Forced):** User *must* select 1 (e.g., Chocolate Type: Dark vs. White).
  * **Optional (Extras):** User *can* select multiple (e.g., Toppings: Oreo, Coconut, Peanuts).
* **Selection Constraints:** Logic to handle "Select exactly X" or "Select up to Y".
* **Incremental Pricing:** Logic for "+Q5 Extra Topping" or "+Q10 Extra Chocolate" added automatically to the base price.

### II. Agile Tablet-POS (Frontend UX)

* **Single-Screen Workflow:** Optimized for fast-paced retail (3-click checkout).
* **Smart Cart & Hot Editing:** Modify toppings or bases of an item *after* it has been added to the cart without deleting it.
* **Order Batching:** Support for configuring multiple distinct custom products before hitting "Pay".
* **Cashier Tools:** * Quick-pay buttons for common bills (Q50, Q100).
  * Real-time "Vuelto" (change) calculation.
  * Support for split payments (e.g., Q20 Cash + Q30 Bank Transfer).
* **Daily Close (Corte X/Z):** Summary of expected vs. physical cash with payment method breakdown.

### III. Kitchen Display System (KDS)

* **Live Order Queue:** Real-time dashboard for prep staff showing exact recipe details (Toppings, Salsas).
* **Status Management:** Workflow: (Pending → In Preparation → Ready for Pickup).
* **Efficiency Tracking:** Timestamp logging from "Paid" to "Ready" for operational bottleneck analysis.

### IV. Precision Inventory & Back-office

* **Atomic Deductions (The Heart of Koi POS):** Every sale triggers a deduction of raw materials (Insumos) based on the recipe.
  * *Logic:* 1 Cup Sold = -200g Strawberries, -40ml White Chocolate, -15g Oreo Topping.
* **Wastage Management (Mermas):** Manual adjustment module for the owner to log spoiled fruit or spilled ingredients to sync digital vs. physical stock.
* **Expense Tracking:** Module to log business costs (rent, utility, raw material purchases) to calculate **Net Profit**.
* **Stock Alerts:** Proactive notifications when ingredients hit critical thresholds.

### V. Owner’s Intelligence Dashboard

* **Sales Heatmaps:** Hourly visualization of peak sales times.
* **Topping Popularity Ranking:** Analytics on which modifiers drive the most revenue.
* **Net Profit Analytics:** Automatic calculation: (Total Sales - Ingredient Costs - Logged Expenses).
* **Remote Management:** Cloud-synced data accessible from any mobile or desktop device.

---

## 3. TECHNICAL SPECIFICATIONS & STANDARDS

### Architecture

* **Multi-tenancy:** Every database table MUST include a `business_id` (UUID) to ensure strict data isolation between future clients.
* **API-First:** All frontend actions must communicate via a robust API for future Mobile/E-commerce expansion.
* **Clean Architecture:** Strict separation of Business Logic (Use Cases), Data Layer (Prisma/Drizzle), and UI (React Components).

### Tech Stack

* **Framework:** Next.js (App Router).
* **Styling:** Tailwind CSS + Shadcn/UI
* **Database:** PostgreSQL (Supabase/Neon) with Real-time enabled for KDS.
* **Logic:** TypeScript for type safety across recipes and orders.

---

## 4. LOCALIZATION & FISCAL (GUATEMALA)

* **Currency:** Quetzales (Q).
* **Fiscal Billing:**
  * Persistent `Customers` table (NIT, Name, Address).
  * **"Consumidor Final" (CF)** quick-toggle for fast checkout.
  * **FEL Readiness:** Database schema must include placeholders for `uuid_fel`, `dte_number`, and `certification_date`.
* **UI Language:** **100% Spanish** for all user-facing labels and buttons (e.g., "Cobrar", "Cierre de Caja").

---

## 5. INITIAL DATA SCHEMA (REFERENCE)

* **Tables Required:** `Business`, `Users`, `Products`, `ModifierGroups`, `Modifiers`, `Ingredients`, `Recipes`, `Orders`, `OrderItems`, `OrderModifiers`, `Expenses`.
