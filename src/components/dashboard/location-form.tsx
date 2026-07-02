'use client';

import { useState } from 'react';

interface Props {
  initialLat: number | null;
  initialLng: number | null;
  initialRadius: number;
}

export function LocationForm({ initialLat, initialLng, initialRadius }: Props) {
  const [lat, setLat] = useState(initialLat?.toString() ?? '');
  const [lng, setLng] = useState(initialLng?.toString() ?? '');
  const [radius, setRadius] = useState(initialRadius.toString());
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setMessage('');

    const parsedLat = lat.trim() ? parseFloat(lat) : null;
    const parsedLng = lng.trim() ? parseFloat(lng) : null;
    const parsedRadius = parseInt(radius) || 200;

    const res = await fetch('/api/businesses/location', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ lat: parsedLat, lng: parsedLng, geo_radius_m: parsedRadius }),
    });

    if (res.ok) {
      setMessage('Ubicación guardada.');
    } else {
      const data = await res.json();
      setMessage(data.error ?? 'Error al guardar.');
    }
    setSaving(false);
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <p className="text-sm text-gray-500">
        Configura la ubicación de tu negocio para que los clientes con la app reciban un aviso
        cuando estén cerca. Requiere plan Pro o Premium.
      </p>

      <div className="flex gap-3">
        <div className="flex-1">
          <label className="block text-sm font-medium text-gray-700 mb-1">Latitud</label>
          <input
            type="number"
            step="any"
            value={lat}
            onChange={e => setLat(e.target.value)}
            placeholder="ej. 4.7110"
            className="w-full border rounded-lg px-3 py-2 text-sm"
          />
        </div>
        <div className="flex-1">
          <label className="block text-sm font-medium text-gray-700 mb-1">Longitud</label>
          <input
            type="number"
            step="any"
            value={lng}
            onChange={e => setLng(e.target.value)}
            placeholder="ej. -74.0721"
            className="w-full border rounded-lg px-3 py-2 text-sm"
          />
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Radio de detección (metros)
        </label>
        <input
          type="number"
          min="50"
          max="5000"
          value={radius}
          onChange={e => setRadius(e.target.value)}
          className="w-full border rounded-lg px-3 py-2 text-sm"
        />
        <p className="text-xs text-gray-400 mt-1">Recomendado: 200 m. Mínimo 50 m.</p>
      </div>

      <button
        type="submit"
        disabled={saving}
        className="self-start bg-primary text-primary-foreground px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-50"
      >
        {saving ? 'Guardando...' : 'Guardar ubicación'}
      </button>

      {message && <p className="text-sm text-gray-600">{message}</p>}
    </form>
  );
}
