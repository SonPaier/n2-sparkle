import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface CustomerCategory {
  id: string;
  name: string;
  sort_order: number;
}

export interface CustomerCategoryAssignment {
  customer_id: string;
  category_id: string;
}

export function useCustomerCategories(instanceId: string | null) {
  const [categories, setCategories] = useState<CustomerCategory[]>([]);
  const [assignments, setAssignments] = useState<CustomerCategoryAssignment[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchAll = useCallback(async () => {
    if (!instanceId) return;
    setLoading(true);

    const [catRes, assignRes] = await Promise.all([
      (supabase as any)
        .from('customer_categories')
        .select('id, name, sort_order')
        .eq('instance_id', instanceId)
        .eq('active', true)
        .order('sort_order'),
      (supabase as any)
        .from('customer_category_assignments')
        .select('customer_id, category_id')
        .eq('instance_id', instanceId),
    ]);

    if (!catRes.error) setCategories(catRes.data || []);
    if (!assignRes.error) setAssignments(assignRes.data || []);
    setLoading(false);
  }, [instanceId]);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  // Map: categoryId -> count of customers
  const customerCounts: Record<string, number> = {};
  for (const a of assignments) {
    customerCounts[a.category_id] = (customerCounts[a.category_id] || 0) + 1;
  }

  // Map: customerId -> categoryId[]
  const customerCategoryMap = new Map<string, string[]>();
  for (const a of assignments) {
    const list = customerCategoryMap.get(a.customer_id) || [];
    list.push(a.category_id);
    customerCategoryMap.set(a.customer_id, list);
  }

  return {
    categories,
    assignments,
    customerCounts,
    customerCategoryMap,
    loading,
    refetch: fetchAll,
  };
}

export async function syncCustomerCategoryAssignments(
  customerId: string,
  instanceId: string,
  selectedCategoryIds: string[],
) {
  // Get current assignments
  const { data: current } = await (supabase as any)
    .from('customer_category_assignments')
    .select('id, category_id')
    .eq('customer_id', customerId);

  const currentIds = new Set((current || []).map((a: any) => a.category_id));
  const selectedSet = new Set(selectedCategoryIds);

  // Delete removed
  const toDelete = (current || []).filter((a: any) => !selectedSet.has(a.category_id));
  if (toDelete.length > 0) {
    await (supabase as any)
      .from('customer_category_assignments')
      .delete()
      .in('id', toDelete.map((a: any) => a.id));
  }

  // Insert new
  const toInsert = selectedCategoryIds.filter(id => !currentIds.has(id));
  if (toInsert.length > 0) {
    await (supabase as any)
      .from('customer_category_assignments')
      .insert(toInsert.map(categoryId => ({
        customer_id: customerId,
        category_id: categoryId,
        instance_id: instanceId,
      })));
  }
}
