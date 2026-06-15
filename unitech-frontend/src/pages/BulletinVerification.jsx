import { useEffect, useMemo, useState } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import api from '../services/api';

function formatScore(value) {
  if (value === null || value === undefined || value === '') return '-';
  const number = Number(value);
  if (!Number.isFinite(number)) return String(value);
  return number.toFixed(2).replace(/\.00$/, '');
}

export default function BulletinVerification() {
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const [payload, setPayload] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const trimestre = searchParams.get('trimestre') || '1';
  const annee = searchParams.get('annee') || '';
  const code = searchParams.get('code') || '';

  useEffect(() => {
    let active = true;

    async function load() {
      setLoading(true);
      setError('');
      try {
        const response = await api.get(`/public/bulletins/${id}`, {
          params: { trimestre, annee, code },
        });
        if (active) setPayload(response.data || null);
      } catch (err) {
        if (!active) return;
        setError(err.response?.data?.error || 'Bulletin introuvable ou code invalide.');
      } finally {
        if (active) setLoading(false);
      }
    }

    load();
    return () => {
      active = false;
    };
  }, [id, trimestre, annee, code]);

  const student = payload?.student || {};
  const stats = payload?.stats || {};
  const notes = useMemo(() => payload?.notes || [], [payload]);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 px-4 py-12 text-white">
        <div className="mx-auto max-w-3xl rounded-3xl border border-slate-800 bg-slate-900/70 p-8">
          <p className="text-sm uppercase tracking-[0.25em] text-sky-300">Verification en cours</p>
          <h1 className="mt-3 text-3xl font-bold">Chargement du bulletin</h1>
          <p className="mt-2 text-slate-300">Veuillez patienter pendant la verification du bulletin.</p>
        </div>
      </div>
    );
  }

  if (error || !payload) {
    return (
      <div className="min-h-screen bg-slate-950 px-4 py-12 text-white">
        <div className="mx-auto max-w-3xl rounded-3xl border border-rose-900/40 bg-rose-950/40 p-8">
          <p className="text-sm uppercase tracking-[0.25em] text-rose-200">Verification echouee</p>
          <h1 className="mt-3 text-3xl font-bold">Bulletin non verifie</h1>
          <p className="mt-2 text-rose-100/90">{error || 'Aucune donnee disponible.'}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(59,130,246,0.18),_transparent_40%),linear-gradient(180deg,#020617,#0f172a)] px-4 py-10 text-white">
      <div className="mx-auto max-w-5xl space-y-6">
        <div className="rounded-[32px] border border-emerald-500/30 bg-slate-950/80 p-6 shadow-2xl">
          <p className="text-sm uppercase tracking-[0.25em] text-emerald-300">Bulletin verifie</p>
          <h1 className="mt-2 text-3xl font-bold">{`${student.prenom || ''} ${student.nom || ''}`.trim()}</h1>
          <p className="mt-2 text-slate-300">
            Classe {student.classe || '-'} - Trimestre {payload?.bulletin?.trimestre || '-'} - Annee {payload?.bulletin?.schoolYear || '-'}
          </p>
          <p className="mt-2 text-sm text-slate-400">Code de verification: {payload?.bulletin?.verificationCode || '-'}</p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-3xl border border-slate-800 bg-slate-900/70 p-5">
            <p className="text-sm text-slate-400">Moyenne generale</p>
            <p className="mt-2 text-3xl font-bold">{formatScore(stats.moyenneGenerale)}</p>
          </div>
          <div className="rounded-3xl border border-slate-800 bg-slate-900/70 p-5">
            <p className="text-sm text-slate-400">Rang</p>
            <p className="mt-2 text-3xl font-bold">{stats.rang ?? '-'}</p>
          </div>
          <div className="rounded-3xl border border-slate-800 bg-slate-900/70 p-5">
            <p className="text-sm text-slate-400">Meilleure moyenne</p>
            <p className="mt-2 text-3xl font-bold">{formatScore(stats.meilleureMoyenneClasse)}</p>
          </div>
          <div className="rounded-3xl border border-slate-800 bg-slate-900/70 p-5">
            <p className="text-sm text-slate-400">Plus faible moyenne</p>
            <p className="mt-2 text-3xl font-bold">{formatScore(stats.plusFaibleMoyenneClasse)}</p>
          </div>
        </div>

        <div className="overflow-hidden rounded-[32px] border border-slate-800 bg-slate-950/80">
          <div className="border-b border-slate-800 px-6 py-4">
            <h2 className="text-lg font-semibold">Detaill des matieres</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-slate-900 text-slate-300">
                <tr>
                  <th className="px-4 py-3 text-left">Matiere</th>
                  <th className="px-4 py-3 text-left">Enseignant</th>
                  <th className="px-4 py-3 text-left">Coefficient</th>
                  <th className="px-4 py-3 text-left">Devoir</th>
                  <th className="px-4 py-3 text-left">Composition</th>
                  <th className="px-4 py-3 text-left">Moyenne classe</th>
                  <th className="px-4 py-3 text-left">Appreciation</th>
                </tr>
              </thead>
              <tbody>
                {notes.map((row) => (
                  <tr key={row.matiere} className="border-t border-slate-800">
                    <td className="px-4 py-3">{row.matiere}</td>
                    <td className="px-4 py-3">{row.enseignant}</td>
                    <td className="px-4 py-3">{row.coefficient}</td>
                    <td className="px-4 py-3">{formatScore(row.devoir)}</td>
                    <td className="px-4 py-3">{formatScore(row.composition)}</td>
                    <td className="px-4 py-3">{formatScore(row.moyenneClasse)}</td>
                    <td className="px-4 py-3">{row.appreciation}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
