import React, { useEffect, useRef, useState } from 'react';
import JsBarcode from 'jsbarcode';
import { api } from '../../api';

function BarcodeCard({ card, onDelete }) {
  const ref = useRef(null);

  useEffect(() => {
    if (!ref.current || !card.card_id) return;
    JsBarcode(ref.current, card.card_id, {
      format: 'CODE128',
      displayValue: true,
      fontSize: 16,
      margin: 8,
      height: 48,
    });
  }, [card.card_id]);

  const handleDownload = () => {
    const canvas = document.createElement('canvas');
    // Generate PNG directly from canvas to avoid SVG conversion issues.
    JsBarcode(canvas, card.card_id, {
      format: 'CODE128',
      displayValue: true,
      fontSize: 16,
      margin: 8,
      height: 48,
      background: '#ffffff',
      lineColor: '#000000',
    });

    canvas.toBlob((blob) => {
      if (!blob) return;
      const pngUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = pngUrl;
      a.download = `${card.card_name || 'Card'}-${card.card_id}.png`;
      a.click();
      URL.revokeObjectURL(pngUrl);
    }, 'image/png');
  };

  return (
    <div className="p-4 rounded-lg border border-school-blue-light/30 bg-school-surface">
      <p className="m-0 text-school-blue font-semibold">{card.card_name || 'Visitor'}</p>
      <p className="mt-1 mb-2 text-school-blue-light text-sm">Card #{card.card_id}</p>
      <svg ref={ref} className="bg-white rounded border border-school-blue-light/30" />
      <button type="button" onClick={handleDownload} className="mt-3 py-2 px-4 rounded-lg bg-school-blue text-school-white font-medium hover:opacity-90 transition-opacity">
        Download PNG
      </button>
      <button
        type="button"
        onClick={() => onDelete(card)}
        className="mt-2 py-2 px-4 rounded-lg bg-school-red text-school-white font-medium hover:opacity-90 transition-opacity"
      >
        Delete barcode
      </button>
    </div>
  );
}

export default function CardsManage() {
  const [cards, setCards] = useState([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ card_name: 'Visitor', count: 1 });
  const [message, setMessage] = useState('');

  const loadCards = () => {
    setLoading(true);
    api('/api/cards')
      .then(setCards)
      .catch((e) => setMessage(e.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadCards();
  }, []);

  const handleGenerate = (e) => {
    e.preventDefault();
    setMessage('');
    api('/api/cards/generate', {
      method: 'POST',
      body: JSON.stringify({
        card_name: form.card_name.trim() || 'Visitor',
        count: Number(form.count) || 1,
      }),
    })
      .then((result) => {
        const generated = Array.isArray(result.generated) ? result.generated : [];
        setCards((prev) => [...generated, ...prev]);
        setMessage(`${generated.length} card(s) generated for ${form.card_name || 'Visitor'}.`);
      })
      .catch((e) => setMessage(e.message));
  };

  const handleDelete = (card) => {
    if (!window.confirm(`Delete card ${card.card_id}?`)) return;
    setMessage('');
    api(`/api/cards/${card.id}`, { method: 'DELETE' })
      .then(() => {
        setCards((prev) => prev.filter((c) => c.id !== card.id));
        setMessage(`Card ${card.card_id} deleted.`);
      })
      .catch((e) => setMessage(e.message));
  };

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <h2 className="text-school-blue text-xl font-bold m-0 mb-4">Visitor Cards</h2>
      <p className="text-school-blue-light text-sm mt-0 mb-4">
        Cards are system-approved. Unregistered barcodes are rejected at Gate.
      </p>
      <form onSubmit={handleGenerate} className="mb-4 p-4 rounded-lg border border-school-blue-light/30 bg-school-surface">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 items-end">
          <label className="block text-school-blue font-medium">
            Card name
            <input
              value={form.card_name}
              onChange={(e) => setForm((f) => ({ ...f, card_name: e.target.value }))}
              placeholder="Visitor"
              className="mt-1 block w-full px-3 py-2 border border-school-blue-light rounded-lg"
            />
          </label>
          <label className="block text-school-blue font-medium">
            Quantity
            <input
              type="number"
              min="1"
              max="200"
              value={form.count}
              onChange={(e) => setForm((f) => ({ ...f, count: e.target.value }))}
              className="mt-1 block w-full px-3 py-2 border border-school-blue-light rounded-lg"
            />
          </label>
          <button
            type="submit"
            className="py-2 px-4 rounded-lg bg-school-blue text-school-white font-medium hover:opacity-90 transition-opacity"
          >
            Generate cards
          </button>
        </div>
      </form>
      {message && <p className="p-3 rounded-lg bg-school-surface border border-school-blue-light/30 text-school-blue">{message}</p>}
      {loading ? (
        <p className="text-school-blue-light">Loading cards...</p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {cards.map((card) => <BarcodeCard key={card.id} card={card} onDelete={handleDelete} />)}
          {cards.length === 0 && (
            <p className="text-school-blue-light">No cards yet. Generate your first card.</p>
          )}
        </div>
      )}
    </div>
  );
}
