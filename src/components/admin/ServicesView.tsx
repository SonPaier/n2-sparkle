import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { Plus, Loader2, Search, Settings2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useIsMobile } from '@/hooks/use-mobile';
import { Input } from '@/components/ui/input';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { CategoryManagementDialog } from './CategoryManagementDialog';
import { ServiceFormDialog } from './ServiceFormDialog';
import type { ServiceData } from './ServiceFormDialog';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

interface Service {
  id: string;
  name: string;
  short_name: string | null;
  description: string | null;
  duration_minutes: number | null;
  price: number | null;
  prices_are_net: boolean | null;
  category_id: string | null;
  active: boolean | null;
  sort_order: number | null;
  is_popular: boolean | null;
  unit: string;
}

interface ServiceCategory {
  id: string;
  name: string;
  slug: string | null;
  description: string | null;
  sort_order: number;
  active: boolean;
  prices_are_net: boolean;
}

interface ServicesViewProps {
  instanceId: string;
}

// Inline editable price component
const InlineEditablePrice = ({ 
  service, 
  onPriceUpdate 
}: { 
  service: Service; 
  onPriceUpdate: (serviceId: string, newPrice: number | null) => Promise<void>;
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState('');
  const [saving, setSaving] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const formatDisplayPrice = () => {
    return service.price ? `${service.price} zł` : '-';
  };

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setEditValue(service.price?.toString() || '');
    setIsEditing(true);
  };

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  const handleSave = async () => {
    if (saving) return;
    
    const numValue = editValue.trim() === '' ? null : parseFloat(editValue.replace(',', '.'));
    
    if (editValue.trim() !== '' && (isNaN(numValue!) || numValue! < 0)) {
      toast.error('Nieprawidłowa cena');
      setIsEditing(false);
      return;
    }

    if (numValue === service.price) {
      setIsEditing(false);
      return;
    }

    setSaving(true);
    try {
      await onPriceUpdate(service.id, numValue);
      setIsEditing(false);
    } catch {
      // Error handled in parent
    } finally {
      setSaving(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSave();
    } else if (e.key === 'Escape') {
      setIsEditing(false);
    }
  };

  if (isEditing) {
    return (
      <div className="flex items-center gap-1" onClick={e => e.stopPropagation()}>
        <input
          ref={inputRef}
          type="text"
          inputMode="decimal"
          value={editValue}
          onChange={(e) => setEditValue(e.target.value)}
          onBlur={handleSave}
          onKeyDown={handleKeyDown}
          disabled={saving}
          className="w-20 px-2 py-1 text-sm text-right border rounded focus:outline-none focus:ring-2 focus:ring-primary"
        />
        <span className="text-sm text-muted-foreground">zł</span>
      </div>
    );
  }

  return (
    <span 
      onClick={handleClick}
      className="text-sm font-semibold text-primary whitespace-nowrap cursor-pointer hover:bg-primary/10 px-2 py-1 rounded -mx-2 -my-1"
      title="Kliknij aby edytować cenę"
    >
      {formatDisplayPrice()}
    </span>
  );
};

// Sortable service row component for desktop
const SortableServiceRow = ({ 
  service, 
  onEdit,
  onPriceUpdate,
  disabled,
}: { 
  service: Service; 
  onEdit: () => void; 
  onPriceUpdate: (serviceId: string, newPrice: number | null) => Promise<void>;
  disabled: boolean;
}) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: service.id, disabled });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      onClick={onEdit}
      className={cn(
        "flex items-center gap-2 px-4 py-3 border-b border-border/30 last:border-b-0 w-full text-left hover:bg-primary/5 transition-colors cursor-pointer",
        !service.active && "opacity-50",
        isDragging && "opacity-50 bg-muted z-50",
        !disabled && "cursor-grab active:cursor-grabbing"
      )}
    >
      <div className="flex-1 min-w-0 flex items-center gap-2">
        <span className={cn("truncate", !service.active && "line-through")}>{service.name}</span>
        {!service.active && (
          <span className="text-xs bg-muted px-2 py-0.5 rounded shrink-0">nieaktywna</span>
        )}
      </div>
      
      <div className="flex items-center gap-2 shrink-0">
        <InlineEditablePrice service={service} onPriceUpdate={onPriceUpdate} />
      </div>
    </div>
  );
};

// Simple service row for mobile (no drag)
const ServiceRow = ({ 
  service, 
  onEdit,
  onPriceUpdate,
}: { 
  service: Service; 
  onEdit: () => void; 
  onPriceUpdate: (serviceId: string, newPrice: number | null) => Promise<void>;
}) => {
  return (
    <button
      type="button"
      onClick={onEdit}
      className={cn(
        "flex items-center gap-2 px-4 py-2.5 border-b border-border/30 last:border-b-0 w-full text-left hover:bg-primary/5 transition-colors",
        !service.active && "opacity-50"
      )}
    >
      <div className="flex-1 min-w-0 flex items-center gap-2">
        <span className={cn(
          "text-sm leading-tight line-clamp-2",
          !service.active && "line-through"
        )}>
          {service.name}
        </span>
        {!service.active && (
          <span className="text-xs bg-muted px-2 py-0.5 rounded shrink-0">nieaktywna</span>
        )}
      </div>
      
      <div className="flex items-center gap-2 shrink-0">
        <InlineEditablePrice service={service} onPriceUpdate={onPriceUpdate} />
      </div>
    </button>
  );
};

const ServicesView = ({ instanceId }: ServicesViewProps) => {
  const isMobile = useIsMobile();
  const [services, setServices] = useState<Service[]>([]);
  const [categories, setCategories] = useState<ServiceCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingService, setEditingService] = useState<Service | null>(null);
  const [defaultCategoryId, setDefaultCategoryId] = useState<string>('');
  
  // Confirm dialog state
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmData, setConfirmData] = useState<{ id: string; isDeactivate: boolean } | null>(null);
  
  // Category management dialog state
  const [categoryManagementOpen, setCategoryManagementOpen] = useState(false);

  // DnD sensors
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const fetchCategories = useCallback(async () => {
    if (!instanceId) return;
    
    try {
      const { data, error } = await supabase
        .from('unified_categories')
        .select('*')
        .eq('instance_id', instanceId)
        .eq('active', true)
        .order('sort_order');
      
      if (error) throw error;
      setCategories((data as ServiceCategory[]) || []);
    } catch (error) {
      console.error('Error fetching categories:', error);
    }
  }, [instanceId]);

  const fetchServices = useCallback(async () => {
    if (!instanceId) return;
    
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('unified_services')
        .select('*')
        .eq('instance_id', instanceId)
        .order('sort_order');
      
      if (error) throw error;
      setServices((data as Service[]) || []);
    } catch (error) {
      console.error('Error fetching services:', error);
      toast.error('Błąd ładowania usług');
    } finally {
      setLoading(false);
    }
  }, [instanceId]);

  useEffect(() => {
    const loadData = async () => {
      await fetchCategories();
      await fetchServices();
    };
    loadData();
  }, [fetchCategories, fetchServices]);

  // Filter services by search query
  const filteredServices = useMemo(() => {
    if (!searchQuery.trim()) return services;
    const query = searchQuery.toLowerCase().trim();
    return services.filter(s => 
      s.name.toLowerCase().includes(query) || 
      (s.short_name && s.short_name.toLowerCase().includes(query))
    );
  }, [services, searchQuery]);

  const getServicesByCategory = (categoryId: string | null) => {
    if (categoryId === null) {
      return filteredServices.filter(s => !s.category_id || !categories.some(c => c.id === s.category_id));
    }
    return filteredServices.filter(s => s.category_id === categoryId);
  };

  const openEditDialog = (service?: Service, preselectedCategoryId?: string) => {
    if (service) {
      setEditingService(service);
      setDefaultCategoryId(service.category_id || '');
    } else {
      setEditingService(null);
      setDefaultCategoryId(preselectedCategoryId || '');
    }
    setEditDialogOpen(true);
  };

  const handleDeleteClick = async (serviceId: string) => {
    setEditDialogOpen(false);
    
    try {
      const { count } = await supabase
        .from('calendar_items')
        .select('id', { count: 'exact', head: true })
        .contains('title', serviceId);
      
      // For now, simple check - if service has any calendar items referencing it, deactivate
      // In future, we can add a service_id FK to calendar_items
      const hasItems = (count || 0) > 0;
      setConfirmData({ id: serviceId, isDeactivate: hasItems });
      setConfirmOpen(true);
    } catch (error) {
      console.error('Error checking calendar items:', error);
      // Default to allowing delete
      setConfirmData({ id: serviceId, isDeactivate: false });
      setConfirmOpen(true);
    }
  };

  const handleConfirmDelete = async () => {
    if (!confirmData) return;
    
    try {
      if (confirmData.isDeactivate) {
        const { error } = await supabase
          .from('unified_services')
          .update({ active: false })
          .eq('id', confirmData.id);
        
        if (error) throw error;
        toast.success('Usługa dezaktywowana');
      } else {
        const { error } = await supabase
          .from('unified_services')
          .delete()
          .eq('id', confirmData.id);
        
        if (error) throw error;
        toast.success('Usługa usunięta');
      }
      
      fetchServices();
    } catch (error) {
      console.error('Error deleting service:', error);
      toast.error('Błąd usuwania usługi');
    }
  };

  // Handle drag end for reordering services
  const handleDragEnd = async (event: DragEndEvent, categoryId: string | null) => {
    const { active, over } = event;
    
    if (!over || active.id === over.id) return;
    
    const categoryServices = categoryId === null 
      ? services.filter(s => !s.category_id || !categories.some(c => c.id === s.category_id))
      : services.filter(s => s.category_id === categoryId);
    
    const oldIndex = categoryServices.findIndex(s => s.id === active.id);
    const newIndex = categoryServices.findIndex(s => s.id === over.id);
    
    if (oldIndex === -1 || newIndex === -1) return;
    
    const reorderedCategoryServices = arrayMove(categoryServices, oldIndex, newIndex);
    
    const newServices = services.map(s => {
      const reorderedIdx = reorderedCategoryServices.findIndex(rs => rs.id === s.id);
      if (reorderedIdx !== -1) {
        return { ...s, sort_order: reorderedIdx };
      }
      return s;
    });
    setServices(newServices);
    
    try {
      const updates = reorderedCategoryServices.map((s, idx) => ({
        id: s.id,
        sort_order: idx,
      }));
      
      for (const update of updates) {
        await supabase
          .from('unified_services')
          .update({ sort_order: update.sort_order })
          .eq('id', update.id);
      }
    } catch (error) {
      console.error('Error reordering services:', error);
      toast.error('Błąd zmiany kolejności');
      fetchServices();
    }
  };

  // Inline price update handler
  const handleInlinePriceUpdate = useCallback(async (serviceId: string, newPrice: number | null) => {
    setServices(prev => prev.map(s => 
      s.id === serviceId ? { ...s, price: newPrice } : s
    ));

    try {
      const { error } = await supabase
        .from('unified_services')
        .update({ price: newPrice })
        .eq('id', serviceId);
      
      if (error) throw error;
      toast.success('Cena zaktualizowana');
    } catch (error) {
      console.error('Error updating price:', error);
      toast.error('Błąd aktualizacji ceny');
      fetchServices();
      throw error;
    }
  }, [fetchServices]);

  // Compute service counts per category
  const serviceCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    categories.forEach(cat => {
      counts[cat.id] = services.filter(s => s.category_id === cat.id).length;
    });
    return counts;
  }, [categories, services]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const uncategorizedServices = getServicesByCategory(null);
  const isSearching = !!searchQuery.trim();

  return (
    <div className="space-y-6 pb-28 md:pb-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold text-foreground">Usługi</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Zarządzaj usługami i cennikiem. Kategorie są opcjonalne.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <Button onClick={() => setCategoryManagementOpen(true)} variant="outline" size="icon" title="Kategorie">
            <Settings2 className="w-4 h-4" />
          </Button>
          <Button onClick={() => openEditDialog()} className="gap-2">
            <Plus className="w-4 h-4" />
            Dodaj usługę
          </Button>
        </div>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          placeholder="Szukaj po nazwie lub skrócie..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-10"
        />
      </div>

      {/* Uncategorized services */}
      {uncategorizedServices.length > 0 && (
        <div>
          <div className="flex items-center justify-between py-3">
            <h3 className="font-semibold text-foreground uppercase">Bez kategorii</h3>
            <Button variant="ghost" size="icon" onClick={() => openEditDialog(undefined, '')} className="h-8 w-8">
              <Plus className="w-4 h-4" />
            </Button>
          </div>
          <div className="bg-card rounded-lg border">
            {isMobile ? (
              uncategorizedServices.map(service => (
                <ServiceRow
                  key={service.id}
                  service={service}
                  onEdit={() => openEditDialog(service)}
                  onPriceUpdate={handleInlinePriceUpdate}
                />
              ))
            ) : (
              <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragEnd={(e) => handleDragEnd(e, null)}
              >
                <SortableContext items={uncategorizedServices.map(s => s.id)} strategy={verticalListSortingStrategy}>
                  {uncategorizedServices.map(service => (
                    <SortableServiceRow
                      key={service.id}
                      service={service}
                      onEdit={() => openEditDialog(service)}
                      onPriceUpdate={handleInlinePriceUpdate}
                      disabled={isSearching}
                    />
                  ))}
                </SortableContext>
              </DndContext>
            )}
          </div>
        </div>
      )}

      {/* Categories */}
      {categories.map(category => {
        const categoryServices = getServicesByCategory(category.id);

        if (searchQuery.trim() && categoryServices.length === 0) {
          return null;
        }

        return (
          <div key={category.id}>
            <div className="flex items-center justify-between py-3">
              <h3 className="font-semibold text-foreground uppercase">{category.name}</h3>
              <Button variant="ghost" size="icon" onClick={() => openEditDialog(undefined, category.id)} className="h-8 w-8">
                <Plus className="w-4 h-4" />
              </Button>
            </div>
            <div className="bg-card rounded-lg border">
              {categoryServices.length === 0 ? (
                <p className="text-sm text-muted-foreground p-4 text-center">
                  Brak usług w tej kategorii
                </p>
              ) : isMobile ? (
                categoryServices.map(service => (
                  <ServiceRow
                    key={service.id}
                    service={service}
                    onEdit={() => openEditDialog(service)}
                    onPriceUpdate={handleInlinePriceUpdate}
                  />
                ))
              ) : (
                <DndContext
                  sensors={sensors}
                  collisionDetection={closestCenter}
                  onDragEnd={(e) => handleDragEnd(e, category.id)}
                >
                  <SortableContext items={categoryServices.map(s => s.id)} strategy={verticalListSortingStrategy}>
                    {categoryServices.map(service => (
                      <SortableServiceRow
                        key={service.id}
                        service={service}
                        onEdit={() => openEditDialog(service)}
                        onPriceUpdate={handleInlinePriceUpdate}
                        disabled={isSearching}
                      />
                    ))}
                  </SortableContext>
                </DndContext>
              )}
            </div>
          </div>
        );
      })}
      
      {/* Empty state */}
      {categories.length === 0 && uncategorizedServices.length === 0 && (
        <div className="text-center py-8 text-muted-foreground">
          <p>Brak usług. Dodaj pierwszą usługę.</p>
        </div>
      )}

      {/* Edit/Add Service Dialog */}
      <ServiceFormDialog
        open={editDialogOpen}
        onOpenChange={(open) => {
          setEditDialogOpen(open);
        }}
        instanceId={instanceId}
        service={editingService ? {
          id: editingService.id,
          name: editingService.name,
          short_name: editingService.short_name || null,
          description: editingService.description,
          price: editingService.price,
          prices_are_net: editingService.prices_are_net ?? true,
          duration_minutes: editingService.duration_minutes,
          category_id: editingService.category_id,
          is_popular: editingService.is_popular ?? false,
          unit: editingService.unit || 'szt',
        } : null}
        categories={categories}
        onSaved={fetchServices}
        defaultCategoryId={defaultCategoryId}
        totalServicesCount={services.length}
        onDelete={editingService ? () => handleDeleteClick(editingService.id) : undefined}
        existingServices={services.map(s => ({ id: s.id, name: s.name, short_name: s.short_name || null }))}
      />

      {/* Category Management Dialog */}
      <CategoryManagementDialog
        open={categoryManagementOpen}
        onOpenChange={setCategoryManagementOpen}
        instanceId={instanceId}
        serviceCounts={serviceCounts}
        onCategoriesChanged={fetchCategories}
      />

      {/* Delete Confirmation Dialog */}
      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title={confirmData?.isDeactivate 
          ? 'Dezaktywować usługę?'
          : 'Usunąć usługę?'
        }
        description={confirmData?.isDeactivate 
          ? 'Ta usługa ma powiązane zlecenia. Zostanie dezaktywowana zamiast usunięta.'
          : 'Czy na pewno chcesz usunąć tę usługę? Tej operacji nie można cofnąć.'
        }
        confirmLabel={confirmData?.isDeactivate ? 'Dezaktywuj' : 'Usuń'}
        onConfirm={handleConfirmDelete}
        variant="destructive"
      />
    </div>
  );
};

export default ServicesView;