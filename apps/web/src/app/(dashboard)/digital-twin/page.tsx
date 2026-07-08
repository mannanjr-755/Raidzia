'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api, type PaginatedResponse } from '@/lib/api';
import { PageHeader, LoadingSpinner } from '@/components/ui/stat-card';
import { cn } from '@/lib/utils';

interface Project {
  id: string;
  name: string;
  code: string;
}

interface Unit {
  id: string;
  unitNumber: string;
  status: string;
  areaSqFt?: number | string;
  type?: string;
}

interface Floor {
  id: string;
  number: number;
  name?: string;
  units: Unit[];
}

interface Building {
  id: string;
  name: string;
  floors: Floor[];
}

const unitStatusColors: Record<string, { bg: string; border: string; label: string }> = {
  SOLD: { bg: 'bg-green-500', border: 'border-green-600', label: 'Sold' },
  RESERVED: { bg: 'bg-blue-500', border: 'border-blue-600', label: 'Reserved' },
  BOOKED: { bg: 'bg-blue-400', border: 'border-blue-500', label: 'Reserved' },
  AVAILABLE: { bg: 'bg-white', border: 'border-gray-300', label: 'Available' },
  UNDER_CONSTRUCTION: { bg: 'bg-orange-500', border: 'border-orange-600', label: 'Under Construction' },
  TRANSFERRED: { bg: 'bg-purple-500', border: 'border-purple-600', label: 'Transferred' },
};

function UnitCell({ unit }: { unit: Unit }) {
  const style = unitStatusColors[unit.status] || unitStatusColors.AVAILABLE;
  const isLight = unit.status === 'AVAILABLE';

  return (
    <div
      className={cn(
        'relative flex flex-col items-center justify-center rounded border-2 p-2 min-h-[48px] transition-all hover:scale-105 hover:shadow-md cursor-pointer',
        style.bg,
        style.border,
        isLight && 'text-luxury-charcoal'
      )}
      title={`${unit.unitNumber} - ${style.label}`}
    >
      <span className={cn('text-xs font-bold', !isLight && 'text-white')}>{unit.unitNumber}</span>
      {unit.areaSqFt && (
        <span className={cn('text-[10px]', !isLight ? 'text-white/80' : 'text-luxury-slate')}>
          {Number(unit.areaSqFt)} sqft
        </span>
      )}
    </div>
  );
}

function BuildingViewer({ building }: { building: Building }) {
  const sortedFloors = [...building.floors].sort((a, b) => b.number - a.number);

  return (
    <div className="luxury-card p-6">
      <h3 className="text-lg font-semibold text-luxury-charcoal mb-4 flex items-center gap-2">
        <span className="h-2 w-2 rounded-full bg-gold" />
        {building.name}
      </h3>
      <div className="space-y-2">
        {sortedFloors.map((floor) => (
          <div key={floor.id} className="flex items-center gap-3">
            <div className="w-16 shrink-0 text-right">
              <span className="text-xs font-medium text-luxury-slate">
                {floor.name || `Floor ${floor.number}`}
              </span>
            </div>
            <div className="flex-1 grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-2 p-3 rounded-lg bg-luxury-cream border border-luxury-border">
              {floor.units.length === 0 ? (
                <span className="text-xs text-luxury-slate col-span-full text-center py-2">No units</span>
              ) : (
                floor.units.map((unit) => <UnitCell key={unit.id} unit={unit} />)
              )}
            </div>
          </div>
        ))}
      </div>
      {sortedFloors.length === 0 && (
        <p className="text-sm text-luxury-slate text-center py-8">No floors configured</p>
      )}
    </div>
  );
}

export default function DigitalTwinPage() {
  const [selectedProjectId, setSelectedProjectId] = useState<string>('');

  const { data: projects, isLoading: projectsLoading } = useQuery({
    queryKey: ['projects-list'],
    queryFn: () => api.get<PaginatedResponse<Project>>('/projects?limit=100'),
  });

  const { data: buildings, isLoading: buildingsLoading } = useQuery({
    queryKey: ['digital-twin', selectedProjectId],
    queryFn: () => api.get<Building[]>(`/properties/digital-twin/${selectedProjectId}`),
    enabled: !!selectedProjectId,
  });

  return (
    <div>
      <PageHeader
        title="Digital Twin"
        description="Interactive building visualization with unit status"
      />

      <div className="mb-6 flex flex-wrap items-center gap-4">
        <div className="min-w-[240px]">
          <label className="block text-sm font-medium mb-1.5">Select Project</label>
          <select
            className="luxury-input"
            value={selectedProjectId}
            onChange={(e) => setSelectedProjectId(e.target.value)}
            disabled={projectsLoading}
          >
            <option value="">Choose a project...</option>
            {projects?.items.map((p) => (
              <option key={p.id} value={p.id}>{p.name} ({p.code})</option>
            ))}
          </select>
        </div>

        <div className="flex flex-wrap gap-3 mt-6">
          {Object.entries(unitStatusColors).filter(([k]) => k !== 'BOOKED' && k !== 'TRANSFERRED').map(([status, style]) => (
            <div key={status} className="flex items-center gap-2 text-xs">
              <div className={cn('h-4 w-4 rounded border-2', style.bg, style.border)} />
              <span className="text-luxury-slate">{style.label}</span>
            </div>
          ))}
        </div>
      </div>

      {!selectedProjectId ? (
        <div className="luxury-card p-16 text-center">
          <p className="text-luxury-slate">Select a project to view the digital twin</p>
        </div>
      ) : buildingsLoading ? (
        <LoadingSpinner />
      ) : !buildings?.length ? (
        <div className="luxury-card p-16 text-center">
          <p className="text-luxury-slate">No buildings found for this project</p>
        </div>
      ) : (
        <div className="space-y-6">
          {buildings.map((building) => (
            <BuildingViewer key={building.id} building={building} />
          ))}
        </div>
      )}
    </div>
  );
}
