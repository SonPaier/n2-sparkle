

## Plan: Customer categories (separate from service categories)

### Context
User correctly points out that customer categories and service categories are different concepts. We need a **separate table** for customer categories, not reusing `unified_categories`.

### 1. Database migration

**New table: `customer_categories`** — the categories themselves
```sql
CREATE TABLE customer_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  instance_id uuid NOT NULL,
  name text NOT NULL,
  sort_order integer NOT NULL DEFAULT 0,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE customer_categories ENABLE ROW LEVEL SECURITY;
-- SELECT: admin/employee/super_admin
-- ALL: admin/super_admin
```

**New table: `customer_category_assignments`** — many-to-many join
```sql
CREATE TABLE customer_category_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  category_id uuid NOT NULL REFERENCES customer_categories(id) ON DELETE CASCADE,
  instance_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(customer_id, category_id)
);
ALTER TABLE customer_category_assignments ENABLE ROW LEVEL SECURITY;
-- Same RLS pattern
```

### 2. `CategoryManagementDialog` — make reusable

Currently hardcoded to `unified_categories`. Add a `tableName` prop (or create a new `CustomerCategoryManagementDialog`) that works with `customer_categories` table instead. The UI is identical — drag-and-drop, rename, delete, add — just different table.

### 3. `CustomersView.tsx` — category filter chips + management button

- Fetch `customer_categories` and `customer_category_assignments`
- Add "Kategorie" button (gear icon) next to "Mapa" button → opens category management dialog for `customer_categories`
- Show horizontal scrollable category chips above search bar (click to toggle filter, OR logic)
- Filter customer list by selected categories

### 4. `CustomerMapFilters.tsx` — category filter above services

- Add "Kategorie" section above "Usługi" with category chips/checkboxes
- Selected categories filter map markers by customer category
- Pass category filter state through `CustomersMapDrawer` props (extend `MapFilters` type)

### 5. `CustomerEditDrawer.tsx` — assign categories

- Add "Kategorie" section with checkboxes in edit/add form
- On save, sync `customer_category_assignments` (delete removed, insert new)
- Show assigned categories as badges in view mode

### 6. Files to modify
- **Migration**: `customer_categories` + `customer_category_assignments` tables + RLS
- **New file**: `CustomerCategoryManagementDialog.tsx` (copy of `CategoryManagementDialog` targeting `customer_categories`)
- **`CustomersView.tsx`**: fetch categories + assignments, filter chips, management button
- **`CustomerMapFilters.tsx`**: category filter section above services
- **`CustomersMapDrawer.tsx`**: extend `MapFilters` with `categoryIds`, filter addresses
- **`CustomerEditDrawer.tsx`**: category checkboxes + sync on save

