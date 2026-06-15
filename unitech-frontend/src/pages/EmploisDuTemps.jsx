import { useCallback, useEffect, useMemo, useState } from 'react';
import FullCalendar from '@fullcalendar/react';
import timeGridPlugin from '@fullcalendar/timegrid';
import interactionPlugin from '@fullcalendar/interaction';
import frLocale from '@fullcalendar/core/locales/fr';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import api from '../services/api';
import ConfirmDialog from '../components/ConfirmDialog';
import { PageBanner, PageErrorState, PageLoadingState, usePageLoadingVisibility } from '../components/PageState';
import { canAccessResource, normalizeRole } from '../utils/roles.js';

const DAY_TO_INDEX = {
  Lundi: 0,
  Mardi: 1,
  Mercredi: 2,
  Jeudi: 3,
  Vendredi: 4,
  Samedi: 5,
};

const INDEX_TO_DAY = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'];
const DAYS = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'];
const EVENT_COLORS = ['#1d4ed8', '#059669', '#ea580c', '#7c3aed', '#dc2626', '#0f766e', '#4f46e5', '#9333ea'];

function getMondayOfCurrentWeek() {
  const now = new Date();
  const day = now.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  const monday = new Date(now);
  monday.setHours(0, 0, 0, 0);
  monday.setDate(now.getDate() + diff);
  return monday;
}

function combineDayAndTime(baseMonday, dayLabel, timeValue) {
  const index = DAY_TO_INDEX[dayLabel] ?? 0;
  const [hours = '0', minutes = '0'] = String(timeValue || '00:00').split(':');
  const date = new Date(baseMonday);
  date.setDate(baseMonday.getDate() + index);
  date.setHours(Number(hours), Number(minutes), 0, 0);
  return date;
}

function dateToDayLabel(date) {
  const jsDay = date.getDay();
  const index = jsDay === 0 ? 6 : jsDay - 1;
  return INDEX_TO_DAY[index] || 'Lundi';
}

function formatTime(date) {
  const hh = String(date.getHours()).padStart(2, '0');
  const mm = String(date.getMinutes()).padStart(2, '0');
  return `${hh}:${mm}`;
}

function buildEventTitle(item) {
  const parts = [item.classe, item.matiere, item.enseignant_nom].filter(Boolean);
  return parts.join(' • ');
}

function buildColorMap(classes) {
  return classes.reduce((acc, item, index) => {
    acc[item.id] = EVENT_COLORS[index % EVENT_COLORS.length];
    return acc;
  }, {});
}

function computeDurationHours(start, end) {
  if (!start || !end) return 0;
  const [startH = 0, startM = 0] = String(start).split(':').map(Number);
  const [endH = 0, endM = 0] = String(end).split(':').map(Number);
  const totalMinutes = (endH * 60 + endM) - (startH * 60 + startM);
  return totalMinutes > 0 ? totalMinutes / 60 : 0;
}

function sanitizeFileName(value) {
  return String(value || 'emploi-du-temps')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9-_]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .toLowerCase();
}

function EmploisDuTemps() {
  const role = normalizeRole(localStorage.getItem('role'));
  const canEditSchedules = canAccessResource(role, 'schedules', 'create', ['directeur', 'promoteur', 'censeur', 'surveillant']);
  const [rows, setRows] = useState([]);
  const [affectations, setAffectations] = useState([]);
  const [trimestres, setTrimestres] = useState([]);
  const [allClasses, setAllClasses] = useState([]);
  const [viewMode, setViewMode] = useState('matrix');
  const [selectedAffectationId, setSelectedAffectationId] = useState('');
  const [selectedClasseId, setSelectedClasseId] = useState('');
  const [selectedTrimestreId, setSelectedTrimestreId] = useState('');
  const [selectedDay, setSelectedDay] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [schoolInfo, setSchoolInfo] = useState(null);
  const [activeSchoolYear, setActiveSchoolYear] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [editTarget, setEditTarget] = useState(null);
  const [editForm, setEditForm] = useState({
    jour: '',
    heure_debut: '',
    heure_fin: '',
  });
  const [deleteTarget, setDeleteTarget] = useState(null);
  const showLoading = usePageLoadingVisibility(loading);
  const weekStart = useMemo(() => getMondayOfCurrentWeek(), []);

  function openEditDialog(item) {
    if (!item) return;
    setEditTarget(item);
    setEditForm({
      jour: item.jour || 'Lundi',
      heure_debut: item.heure_debut || '',
      heure_fin: item.heure_fin || '',
    });
    setDeleteTarget(null);
    setError('');
    setSuccess('');
  }

  function closeEditDialog() {
    if (saving) return;
    setEditTarget(null);
  }

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [emploisResponse, affectationsResponse, schoolResponse, dashboardResponse, classesResponse, trimestresResponse] = await Promise.all([
        api.get('/system/emplois'),
        api.get('/affectation'),
        api.get('/auth/me'),
        api.get('/system/dashboard/summary'),
        api.get('/classes'),
        canEditSchedules ? api.get('/system/trimestres') : Promise.resolve({ data: [] }),
      ]);
      setRows(emploisResponse.data || []);
      setAffectations(affectationsResponse.data || []);
      setSchoolInfo(schoolResponse.data || null);
      setActiveSchoolYear(dashboardResponse.data?.currentSchoolYear || '');
      setAllClasses(canEditSchedules ? (classesResponse.data || []) : []);
      const trimestreRows = trimestresResponse.data || [];
      setTrimestres(trimestreRows);
      setSelectedTrimestreId((prev) => prev || String(trimestreRows[0]?.id || ''));
    } catch {
      setError("Impossible de charger l'emploi du temps.");
    } finally {
      setLoading(false);
    }
  }, [canEditSchedules]);

  useEffect(() => {
    const timer = setTimeout(() => {
      load();
    }, 0);

    return () => clearTimeout(timer);
  }, [load]);

  const classes = useMemo(() => {
    const map = new Map();
    allClasses.forEach((item) => {
      const id = String(item.id || '');
      const label = item.name || item.nom;
      if (id && label && !map.has(id)) {
        map.set(id, { id, label });
      }
    });
    affectations.forEach((item) => {
      const id = String(item.classe_id || '');
      const label = item.classe_nom || item.classe || item.classe_id;
      if (id && label && !map.has(id)) {
        map.set(id, { id, label });
      }
    });
    rows.forEach((item) => {
      const id = String(item.classe_id || '');
      if (id && item.classe && !map.has(id)) {
        map.set(id, { id, label: item.classe });
      }
    });
    return Array.from(map.values()).sort((a, b) => a.label.localeCompare(b.label));
  }, [allClasses, affectations, rows]);

  const colorMap = useMemo(() => buildColorMap(classes), [classes]);

  const filteredRows = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase();
    return rows.filter((item) => {
      const matchesClasse = !selectedClasseId || String(item.classe_id || '') === String(selectedClasseId);
      const matchesDay = !selectedDay || item.jour === selectedDay;
      const haystack = `${item.classe || ''} ${item.matiere || ''} ${item.enseignant_nom || ''}`.toLowerCase();
      const matchesSearch = !normalizedSearch || haystack.includes(normalizedSearch);
      return matchesClasse && matchesDay && matchesSearch;
    });
  }, [rows, selectedClasseId, selectedDay, searchTerm]);

  const stats = useMemo(() => {
    const totalHours = filteredRows.reduce((acc, item) => acc + computeDurationHours(item.heure_debut, item.heure_fin), 0);
    const teacherCount = new Set(filteredRows.map((item) => item.enseignant_nom).filter(Boolean)).size;
    return {
      totalSlots: filteredRows.length,
      totalHours,
      teacherCount,
    };
  }, [filteredRows]);

  const weeklyClassRows = useMemo(() => {
    return classes
      .filter((item) => !selectedClasseId || String(item.id) === String(selectedClasseId))
      .map((item) => ({
        ...item,
        days: DAYS.map((day) => ({
          day,
          slots: filteredRows
            .filter((row) => String(row.classe_id || '') === String(item.id) && row.jour === day)
            .sort((a, b) => String(a.heure_debut || '').localeCompare(String(b.heure_debut || ''))),
        })),
      }));
  }, [classes, filteredRows, selectedClasseId]);

  const events = useMemo(
    () =>
      filteredRows.map((item) => {
        const start = combineDayAndTime(weekStart, item.jour, item.heure_debut);
        const end = item.heure_fin
          ? combineDayAndTime(weekStart, item.jour, item.heure_fin)
          : new Date(start.getTime() + 60 * 60 * 1000);
        const color = colorMap[String(item.classe_id || '')] || '#1d4ed8';

        return {
          id: String(item.id),
          title: buildEventTitle(item),
          start,
          end,
          backgroundColor: color,
          borderColor: color,
          textColor: '#ffffff',
          extendedProps: item,
        };
      }),
    [filteredRows, weekStart, colorMap]
  );

  function handleGeneratePdf() {
    const selectedClasse = classes.find((item) => item.id === String(selectedClasseId));
    if (!selectedClasse) {
      setError('Selectionnez une classe avant de telecharger le PDF.');
      return;
    }
    if (!filteredRows.length) {
      setError("Aucun creneau a exporter pour ce filtre.");
      return;
    }

    const doc = new jsPDF({
      orientation: 'landscape',
      unit: 'mm',
      format: 'a4',
      compress: true,
    });

    const pageWidth = doc.internal.pageSize.getWidth();
    const generatedAt = new Date().toLocaleDateString('fr-FR');
    const title = `Emploi du temps - ${selectedClasse.label}`;

    doc.setFillColor(29, 78, 216);
    doc.roundedRect(10, 8, 12, 12, 2, 2, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(14);
    doc.text(String(schoolInfo?.name || 'U').slice(0, 1).toUpperCase(), 16, 16, { align: 'center' });

    doc.setTextColor(15, 23, 42);
    doc.setFontSize(16);
    doc.text(title, 26, 14);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.text(schoolInfo?.name || 'UNITECH ERP', 26, 19);
    doc.text(`Annee scolaire: ${activeSchoolYear || 'Non definie'}`, pageWidth - 10, 14, { align: 'right' });
    doc.text(`Genere le: ${generatedAt}`, pageWidth - 10, 19, { align: 'right' });

    const uniqueSlots = Array.from(new Set(filteredRows.map((item) => item.heure_debut)))
      .sort((a, b) => a.localeCompare(b));

    const grid = new Map();
    filteredRows.forEach((item) => {
      grid.set(`${item.jour}__${item.heure_debut}`, `${item.matiere || '-'}\n${item.enseignant_nom || '-'}\n${item.heure_debut}${item.heure_fin ? ` - ${item.heure_fin}` : ''}`);
    });

    const body = uniqueSlots.map((slot) => [
      slot,
      ...DAYS.map((day) => grid.get(`${day}__${slot}`) || ''),
    ]);

    autoTable(doc, {
      startY: 26,
      head: [['Heure', ...DAYS]],
      body,
      theme: 'grid',
      styles: {
        fontSize: 7,
        cellPadding: 1.5,
        overflow: 'linebreak',
        valign: 'middle',
        textColor: [15, 23, 42],
        lineColor: [203, 213, 225],
        lineWidth: 0.2,
      },
      headStyles: {
        fillColor: [226, 232, 240],
        textColor: [15, 23, 42],
        fontStyle: 'bold',
        halign: 'center',
      },
      columnStyles: {
        0: { cellWidth: 18, halign: 'center', fontStyle: 'bold' },
        1: { cellWidth: 42 },
        2: { cellWidth: 42 },
        3: { cellWidth: 42 },
        4: { cellWidth: 42 },
        5: { cellWidth: 42 },
        6: { cellWidth: 42 },
      },
      margin: { left: 10, right: 10, bottom: 8 },
      tableWidth: 'wrap',
      didParseCell(data) {
        if (data.section === 'body' && data.column.index > 0) {
          const day = DAYS[data.column.index - 1];
          const slot = uniqueSlots[data.row.index];
          const item = filteredRows.find((row) => row.jour === day && row.heure_debut === slot);
          if (item) {
            const colorHex = colorMap[String(item.classe_id || '')] || '#1d4ed8';
            const red = parseInt(colorHex.slice(1, 3), 16);
            const green = parseInt(colorHex.slice(3, 5), 16);
            const blue = parseInt(colorHex.slice(5, 7), 16);
            data.cell.styles.fillColor = [red, green, blue];
            data.cell.styles.textColor = [255, 255, 255];
          }
        }
      },
      willDrawCell(data) {
        if (data.cursor && data.cursor.y > 195) {
          doc.setPage(1);
        }
      },
    });

    const fileName = `${sanitizeFileName(selectedClasse.label)}-emploi-du-temps.pdf`;
    doc.save(fileName);
  }

  async function createSlotFromSelection(selectionInfo) {
    if (!selectedAffectationId) {
      setError("Selectionnez d'abord une affectation avant de creer un creneau.");
      selectionInfo.view.calendar.unselect();
      return;
    }

    setSaving(true);
    setError('');
    setSuccess('');
    try {
      await api.post('/system/emplois', {
        affectation_id: selectedAffectationId,
        jour: dateToDayLabel(selectionInfo.start),
        heure_debut: formatTime(selectionInfo.start),
        heure_fin: formatTime(selectionInfo.end),
      });
      await load();
      setSuccess('Creneau ajoute avec succes.');
    } catch (err) {
      setError(err.response?.data?.error || "Erreur lors de la creation du creneau.");
    } finally {
      selectionInfo.view.calendar.unselect();
      setSaving(false);
    }
  }

  async function updateSlot(eventApi) {
    setSaving(true);
    setError('');
    setSuccess('');
    try {
      await api.put(`/system/emplois/${eventApi.id}`, {
        jour: dateToDayLabel(eventApi.start),
        heure_debut: formatTime(eventApi.start),
        heure_fin: eventApi.end ? formatTime(eventApi.end) : null,
      });
      await load();
      setSuccess('Creneau mis a jour avec succes.');
    } catch (err) {
      setError(err.response?.data?.error || 'Erreur lors de la mise a jour du creneau.');
      eventApi.revert();
    } finally {
      setSaving(false);
    }
  }

  async function handleEditSubmit(event) {
    event.preventDefault();
    if (!editTarget) return;

    setSaving(true);
    setError('');
    setSuccess('');
    try {
      await api.put(`/system/emplois/${editTarget.id}`, {
        jour: editForm.jour,
        heure_debut: editForm.heure_debut,
        heure_fin: editForm.heure_fin || null,
      });
      await load();
      setEditTarget(null);
      setSuccess('Creneau mis a jour avec succes.');
    } catch (err) {
      setError(err.response?.data?.error || 'Erreur lors de la mise a jour du creneau.');
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteConfirm() {
    if (!deleteTarget) return;
    setSaving(true);
    setError('');
    setSuccess('');
    try {
      await api.delete(`/system/emplois/${deleteTarget.id}`);
      setDeleteTarget(null);
      await load();
      setSuccess('Creneau supprime avec succes.');
    } catch (err) {
      setError(err.response?.data?.error || 'Erreur lors de la suppression du creneau.');
    } finally {
      setSaving(false);
    }
  }

  if (showLoading) {
    return <PageLoadingState title="Chargement de l'emploi du temps" message="La grille hebdomadaire est en cours de preparation." />;
  }

  if (error && !rows.length && !affectations.length) {
    return (
      <PageErrorState
        title="Module emplois du temps indisponible"
        message={error}
        action={
          <button type="button" onClick={load} className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700">
            Reessayer
          </button>
        }
      />
    );
  }

  return (
    <section className="space-y-5">
      <PageBanner tone="success" title={success ? 'Operation reussie' : ''} message={success} />
      <PageBanner tone="error" title={error && (rows.length || affectations.length) ? 'Action impossible' : ''} message={rows.length || affectations.length ? error : ''} />

      <div className="grid gap-4 md:grid-cols-3 xl:grid-cols-4">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-sm text-slate-500">Creneaux visibles</p>
          <p className="mt-2 text-3xl font-semibold text-slate-900">{stats.totalSlots}</p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-sm text-slate-500">Volume horaire</p>
          <p className="mt-2 text-3xl font-semibold text-slate-900">{stats.totalHours.toFixed(1)}h</p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-sm text-slate-500">Enseignants impliques</p>
          <p className="mt-2 text-3xl font-semibold text-slate-900">{stats.teacherCount}</p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-sm text-slate-500">Annee scolaire</p>
          <p className="mt-2 text-lg font-semibold text-slate-900">{activeSchoolYear || 'Non definie'}</p>
        </div>
      </div>

      <div className="grid gap-5 xl:grid-cols-[340px_1fr]">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-base font-semibold text-slate-900">Filtres et actions</h2>
          <div className="mt-4 space-y-3">
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              <button
                type="button"
                onClick={() => setViewMode('matrix')}
                className={`rounded-md px-4 py-2 text-sm font-medium transition ${
                  viewMode === 'matrix'
                    ? 'bg-indigo-600 text-white'
                    : 'border border-slate-300 bg-white text-slate-700 hover:bg-slate-50'
                }`}
              >
                Semaine par classes
              </button>
              <button
                type="button"
                onClick={() => setViewMode('calendar')}
                className={`rounded-md px-4 py-2 text-sm font-medium transition ${
                  viewMode === 'calendar'
                    ? 'bg-indigo-600 text-white'
                    : 'border border-slate-300 bg-white text-slate-700 hover:bg-slate-50'
                }`}
              >
                Vue calendrier
              </button>
            </div>

            {canEditSchedules ? (
              <select
                className="w-full rounded-md border border-slate-300 px-3 py-2"
                value={selectedTrimestreId}
                onChange={(e) => setSelectedTrimestreId(e.target.value)}
              >
                <option value="">Selectionner un trimestre</option>
                {trimestres.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.code} - {item.label}
                  </option>
                ))}
              </select>
            ) : null}

            <select
              className="w-full rounded-md border border-slate-300 px-3 py-2"
              value={selectedClasseId}
              onChange={(e) => {
                setSelectedClasseId(e.target.value);
                setSelectedAffectationId('');
              }}
            >
              <option value="">Toutes les classes</option>
              {classes.map((item) => (
                <option key={item.id} value={item.id}>{item.label}</option>
              ))}
            </select>

            <select
              className="w-full rounded-md border border-slate-300 px-3 py-2"
              value={selectedDay}
              onChange={(e) => setSelectedDay(e.target.value)}
            >
              <option value="">Tous les jours</option>
              {DAYS.map((day) => <option key={day} value={day}>{day}</option>)}
            </select>

            <input
              className="w-full rounded-md border border-slate-300 px-3 py-2"
              placeholder="Rechercher matiere ou enseignant"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />

            <button
              type="button"
              onClick={handleGeneratePdf}
              className="w-full rounded-md bg-slate-800 px-4 py-2 text-sm font-medium text-white hover:bg-slate-900"
            >
              Generer PDF
            </button>
          </div>

          <div className="my-5 border-t border-slate-200" />

          {canEditSchedules ? (
            <>
          <h2 className="text-base font-semibold text-slate-900">Affectation a planifier</h2>
          <p className="mt-1 text-sm text-slate-500">
            Choisissez une affectation, puis dessinez le creneau dans la grille.
          </p>

          <select
            className="mt-4 w-full rounded-md border border-slate-300 px-3 py-2"
            value={selectedAffectationId}
            onChange={(e) => setSelectedAffectationId(e.target.value)}
          >
            <option value="">Selectionner une affectation</option>
            {affectations
              .filter((item) => !selectedClasseId || String(item.classe_id || '') === String(selectedClasseId))
              .map((item) => (
                <option key={item.id} value={item.id}>
                  {(item.classe_nom || item.classe_id)} • {item.nom_matiere} • {item.enseignant_nom || item.enseignant_id}
                </option>
              ))}
          </select>

          <div className="mt-5 rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
            <p className="font-medium text-slate-800">Mode d'emploi</p>
            <p className="mt-2 text-xs text-slate-500">
              Trimestre de reference: {trimestres.find((item) => String(item.id) === String(selectedTrimestreId))?.label || 'Non selectionne'}
            </p>
            <ul className="mt-2 space-y-2">
              <li>1. Filtrer une classe si besoin.</li>
              <li>2. Choisir une affectation.</li>
              <li>3. Cliquer-glisser pour creer un cours.</li>
              <li>4. Deplacer ou redimensionner un bloc pour l'ajuster.</li>
            </ul>
          </div>
            </>
          ) : (
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
              <p className="font-semibold">Consultation uniquement</p>
              <p className="mt-1 text-amber-800">
                Vous pouvez consulter les emplois du temps de vos classes, sans les modifier.
              </p>
            </div>
          )}

          <div className="mt-5 space-y-3">
            <h3 className="text-sm font-semibold text-slate-900">Legende des classes</h3>
            <div className="space-y-2">
              {classes.slice(0, 8).map((item) => (
                <div key={item.id} className="flex items-center gap-2 text-sm text-slate-700">
                  <span className="h-3 w-3 rounded-full" style={{ backgroundColor: colorMap[item.id] }} />
                  <span>{item.label}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-5 space-y-3">
            <h3 className="text-sm font-semibold text-slate-900">Creneaux visibles</h3>
            <div className="max-h-[360px] space-y-2 overflow-y-auto pr-1">
              {filteredRows.map((item) => (
                <div
                  key={item.id}
                  className="block w-full rounded-xl border border-slate-200 p-3 text-left transition hover:border-slate-300 hover:bg-slate-50"
                >
                  <div className="flex items-start gap-3">
                    <span className="mt-1 h-3 w-3 rounded-full" style={{ backgroundColor: colorMap[String(item.classe_id || '')] || '#1d4ed8' }} />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-slate-900">{buildEventTitle(item) || 'Creneau'}</p>
                      <p className="mt-1 text-xs text-slate-500">
                        {item.jour} • {item.heure_debut}{item.heure_fin ? ` - ${item.heure_fin}` : ''}
                      </p>
                      {canEditSchedules ? (
                        <div className="mt-3 flex flex-wrap gap-2">
                          <button
                            type="button"
                            onClick={() => openEditDialog(item)}
                            className="rounded-md bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-indigo-700"
                          >
                            Modifier
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setEditTarget(null);
                              setDeleteTarget(item);
                            }}
                            className="rounded-md border border-rose-200 px-3 py-1.5 text-xs font-medium text-rose-700 hover:bg-rose-50"
                          >
                            Supprimer
                          </button>
                        </div>
                      ) : null}
                    </div>
                  </div>
                </div>
              ))}
              {!filteredRows.length ? <p className="text-sm text-slate-500">Aucun creneau pour ce filtre.</p> : null}
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
          {viewMode === 'calendar' ? (
            <FullCalendar
              plugins={[timeGridPlugin, interactionPlugin]}
              locale={frLocale}
              initialView="timeGridWeek"
              initialDate={weekStart}
              headerToolbar={{
                left: 'title',
                center: '',
                right: 'prev,next today',
              }}
              buttonText={{
                today: 'Cette semaine',
              }}
              weekends={true}
              hiddenDays={[0]}
              firstDay={1}
              allDaySlot={false}
              slotMinTime="07:00:00"
              slotMaxTime="20:00:00"
              slotDuration="00:30:00"
              selectable={canEditSchedules}
              selectMirror
              editable={canEditSchedules}
              eventDurationEditable={canEditSchedules}
              eventStartEditable={canEditSchedules}
              nowIndicator
              height="auto"
              expandRows
              dayHeaderFormat={{ weekday: 'long', day: 'numeric', month: 'short' }}
              events={events}
              select={canEditSchedules ? createSlotFromSelection : undefined}
              eventDrop={canEditSchedules ? (info) => updateSlot(info.event) : undefined}
              eventResize={canEditSchedules ? (info) => updateSlot(info.event) : undefined}
              eventClick={canEditSchedules ? (info) => openEditDialog(info.event.extendedProps) : undefined}
              eventContent={(eventInfo) => (
                <div className="flex h-full flex-col justify-between gap-1 px-1 py-0.5 text-[11px] leading-tight">
                  <div>
                    <div className="font-semibold">{eventInfo.event.extendedProps.matiere || eventInfo.event.title}</div>
                    <div>{eventInfo.event.extendedProps.classe || '-'}</div>
                    <div>{eventInfo.event.extendedProps.enseignant_nom || '-'}</div>
                  </div>
                  {canEditSchedules ? (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        openEditDialog(eventInfo.event.extendedProps);
                      }}
                      className="self-start rounded bg-white/20 px-2 py-0.5 text-[10px] font-semibold text-white ring-1 ring-inset ring-white/30 transition hover:bg-white/30"
                    >
                      Modifier
                    </button>
                  ) : null}
                </div>
              )}
            />
          ) : (
            <div className="space-y-4">
              <div className="flex flex-col gap-1 px-2">
                <h2 className="text-base font-semibold text-slate-900">Vue hebdomadaire des classes</h2>
                <p className="text-sm text-slate-500">
                  Une seule semaine avec les creneaux de toutes les classes visibles.
                </p>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[980px] text-sm">
                  <thead className="bg-slate-50 text-slate-600">
                    <tr className="border-b border-slate-200">
                      <th className="px-3 py-3 text-left">Classe</th>
                      {DAYS.map((day) => (
                        <th key={day} className="px-3 py-3 text-left">{day}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {weeklyClassRows.map((classe) => (
                      <tr key={classe.id} className="border-b border-slate-100 align-top">
                        <td className="px-3 py-3 font-semibold text-slate-900">{classe.label}</td>
                        {classe.days.map((dayBlock) => (
                          <td key={`${classe.id}-${dayBlock.day}`} className="px-3 py-3">
                            <div className="space-y-2">
                              {dayBlock.slots.map((slot) => (
                                <button
                                  key={slot.id}
                                  type="button"
                                  onClick={canEditSchedules ? () => setDeleteTarget(slot) : undefined}
                                  className="block w-full rounded-xl border px-3 py-2 text-left shadow-sm transition hover:shadow"
                                  style={{
                                    borderColor: `${colorMap[String(slot.classe_id || '')] || '#1d4ed8'}40`,
                                    backgroundColor: `${colorMap[String(slot.classe_id || '')] || '#1d4ed8'}12`,
                                  }}
                                >
                                  <p className="text-xs font-semibold text-slate-900">
                                    {slot.heure_debut}{slot.heure_fin ? ` - ${slot.heure_fin}` : ''}
                                  </p>
                                  <p className="mt-1 text-sm font-medium text-slate-800">{slot.matiere || '-'}</p>
                                  <p className="text-xs text-slate-600">{slot.enseignant_nom || '-'}</p>
                                </button>
                              ))}
                              {!dayBlock.slots.length ? (
                                <div className="rounded-lg border border-dashed border-slate-200 px-3 py-4 text-center text-xs text-slate-400">
                                  Aucun creneau
                                </div>
                              ) : null}
                            </div>
                          </td>
                        ))}
                      </tr>
                    ))}
                    {!weeklyClassRows.length ? (
                      <tr>
                        <td colSpan={DAYS.length + 1} className="px-3 py-8 text-center text-slate-400">
                          Aucune classe visible pour ce filtre.
                        </td>
                      </tr>
                    ) : null}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </div>

      <ConfirmDialog
        open={canEditSchedules && Boolean(deleteTarget)}
        title="Supprimer ce creneau"
        message={
          deleteTarget
            ? `Voulez-vous vraiment supprimer le creneau ${deleteTarget.matiere || ''} ${deleteTarget.classe ? `de ${deleteTarget.classe}` : ''} ?`
            : ''
        }
        confirmLabel="Supprimer"
        cancelLabel="Annuler"
        loading={saving}
        loadingLabel="Suppression..."
        onConfirm={handleDeleteConfirm}
        onCancel={() => !saving && setDeleteTarget(null)}
      />

      {canEditSchedules && editTarget ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 p-4">
          <div className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white shadow-2xl">
            <form onSubmit={handleEditSubmit}>
              <div className="border-b border-slate-100 px-6 py-5">
                <h2 className="text-lg font-semibold text-slate-900">Modifier le creneau</h2>
                <p className="mt-1 text-sm text-slate-500">
                  Ajustez le jour ou l'heure du creneau apres sa creation.
                </p>
              </div>

              <div className="space-y-4 px-6 py-5">
                <div className="grid gap-4 sm:grid-cols-2">
                  <label className="space-y-1">
                    <span className="text-sm font-medium text-slate-700">Jour</span>
                    <select
                      className="w-full rounded-md border border-slate-300 px-3 py-2"
                      value={editForm.jour}
                      onChange={(e) => setEditForm((prev) => ({ ...prev, jour: e.target.value }))}
                      required
                    >
                      {DAYS.map((day) => (
                        <option key={day} value={day}>{day}</option>
                      ))}
                    </select>
                  </label>
                  <label className="space-y-1">
                    <span className="text-sm font-medium text-slate-700">Heure de debut</span>
                    <input
                      type="time"
                      className="w-full rounded-md border border-slate-300 px-3 py-2"
                      value={editForm.heure_debut}
                      onChange={(e) => setEditForm((prev) => ({ ...prev, heure_debut: e.target.value }))}
                      required
                    />
                  </label>
                </div>

                <label className="block space-y-1">
                  <span className="text-sm font-medium text-slate-700">Heure de fin</span>
                  <input
                    type="time"
                    className="w-full rounded-md border border-slate-300 px-3 py-2"
                    value={editForm.heure_fin}
                    onChange={(e) => setEditForm((prev) => ({ ...prev, heure_fin: e.target.value }))}
                  />
                </label>

                <div className="rounded-xl bg-slate-50 p-4 text-sm text-slate-600">
                  <p className="font-medium text-slate-800">{buildEventTitle(editTarget) || 'Creneau'}</p>
                  <p className="mt-1">
                    {editTarget.classe || '-'} • {editTarget.matiere || '-'} • {editTarget.enseignant_nom || '-'}
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap justify-between gap-3 border-t border-slate-100 px-6 py-4">
                <button
                  type="button"
                  onClick={() => {
                    setEditTarget(null);
                    setDeleteTarget(editTarget);
                  }}
                  disabled={saving}
                  className="rounded-lg border border-rose-200 px-4 py-2 text-sm font-medium text-rose-700 transition hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  Supprimer
                </button>
                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={closeEditDialog}
                    disabled={saving}
                    className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    Annuler
                  </button>
                  <button
                    type="submit"
                    disabled={saving}
                    className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-70"
                  >
                    {saving ? 'Enregistrement...' : 'Enregistrer'}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </section>
  );
}

export default EmploisDuTemps;
