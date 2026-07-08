import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { fetchItems, createItem } from './api';

// Mobile-first responsive layout (see the px-4 sm:px-6 / flex-col sm:flex-row
// patterns). The whole surface is an example — delete it and pour your own in.
export default function App() {
  const qc = useQueryClient();
  const [title, setTitle] = useState('');
  const {
    data: items,
    isLoading,
    isError,
  } = useQuery({ queryKey: ['items'], queryFn: fetchItems });
  const add = useMutation({
    mutationFn: createItem,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['items'] });
      setTitle('');
    },
  });

  return (
    <main className="mx-auto min-h-screen max-w-2xl px-4 py-8 sm:px-6">
      <h1 className="text-2xl font-bold tracking-tight">Items</h1>
      <p className="mt-1 text-sm text-gray-500">
        Example surface — delete it and pour your own domain in.
      </p>

      <form
        className="mt-6 flex flex-col gap-2 sm:flex-row"
        onSubmit={(e) => {
          e.preventDefault();
          if (title.trim()) add.mutate(title.trim());
        }}
      >
        <input
          className="flex-1 rounded border border-gray-300 px-3 py-2 text-sm"
          placeholder="New item title…"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          aria-label="New item title"
        />
        <button
          type="submit"
          disabled={add.isPending || !title.trim()}
          className="rounded bg-gray-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
        >
          {add.isPending ? 'Adding…' : 'Add'}
        </button>
      </form>

      {add.isError && <p className="mt-2 text-sm text-red-600">{(add.error as Error).message}</p>}

      <ul className="mt-6 space-y-2">
        {isLoading && <li className="text-sm text-gray-500">Loading…</li>}
        {isError && <li className="text-sm text-red-600">Failed to load items.</li>}
        {items?.length === 0 && <li className="text-sm text-gray-500">No items yet.</li>}
        {items?.map((it) => (
          <li key={it.id} className="rounded border border-gray-200 px-3 py-2 text-sm">
            <span className="font-medium">{it.title}</span>
            <span className="ml-2 text-gray-400">{new Date(it.createdAt).toLocaleString()}</span>
          </li>
        ))}
      </ul>
    </main>
  );
}
