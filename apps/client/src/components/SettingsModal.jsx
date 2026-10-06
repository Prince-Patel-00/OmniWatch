import React, { useState, useEffect } from 'react';
import {
  X,
  Database,
  Globe,
  Key,
  CheckCircle,
  AlertCircle,
  ExternalLink,
  ShieldCheck,
  Server,
  RotateCw,
  Sparkles,
  Search,
  Plus,
  Trash2,
  Edit2,
  Check,
  CheckCheck,
  Wifi,
  WifiOff,
  Radio,
  SlidersHorizontal
} from 'lucide-react';
import {
  getMirrorSources,
  checkMirrorsHealth,
  saveMirrorSource,
  updateMirrorSource,
  deleteMirrorSourceItem
} from '../services/api.js';

export default function SettingsModal({ isOpen, onClose, systemStatus }) {
  if (!isOpen) return null;

  const [activeTab, setActiveTab] = useState('mirrors'); // 'mirrors' | 'system'

  // Mirror Registry State
  const [mirrors, setMirrors] = useState([]);
  const [isLoadingMirrors, setIsLoadingMirrors] = useState(false);
  const [isCheckingAll, setIsCheckingAll] = useState(false);
  const [checkingMirrorId, setCheckingMirrorId] = useState(null);
  const [mirrorCategoryFilter, setMirrorCategoryFilter] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [editingMirrorId, setEditingMirrorId] = useState(null);
  const [editFormData, setEditFormData] = useState({ currentDomain: '', candidateDomainsStr: '' });
  const [showAddModal, setShowAddModal] = useState(false);
  const [newMirrorForm, setNewMirrorForm] = useState({
    name: '',
    category: 'Anime',
    type: 'Stream',
    quality: '1080p HD',
    audio: 'Dual Audio & Multi-Sub',
    currentDomain: '',
    candidateDomains: '',
    searchTemplate: 'https://{domain}/search?q={query}',
    directUrlTemplate: 'https://{domain}/'
  });
  const [actionMessage, setActionMessage] = useState(null);

  const providers = systemStatus?.providers || {};
  const db = systemStatus?.database || {};

  // Fetch mirror sources from SQLite registry
  const loadMirrors = async () => {
    setIsLoadingMirrors(true);
    try {
      const res = await getMirrorSources();
      if (res && res.data) {
        setMirrors(res.data);
      }
    } catch (err) {
      console.error('Failed to load mirrors:', err);
    } finally {
      setIsLoadingMirrors(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadMirrors();
    }
  }, [isOpen]);

  // Flash temporary feedback message
  const showMessage = (msg) => {
    setActionMessage(msg);
    setTimeout(() => setActionMessage(null), 4000);
  };

  // Run on-demand check for all mirrors
  const handleCheckAll = async () => {
    setIsCheckingAll(true);
    try {
      const res = await checkMirrorsHealth();
      if (res && res.data) {
        setMirrors(res.data);
        const sum = res.summary || {};
        showMessage(`⚡ Health check completed: ${sum.working || 0} working, ${sum.migrated || 0} auto-migrated, ${sum.offline || 0} offline.`);
      }
    } catch (err) {
      showMessage(`Check error: ${err.message}`);
    } finally {
      setIsCheckingAll(false);
    }
  };

  // Run check for single mirror
  const handleCheckSingle = async (mirrorId) => {
    setCheckingMirrorId(mirrorId);
    try {
      const res = await checkMirrorsHealth(mirrorId);
      if (res && res.data) {
        setMirrors(res.data);
        const r = res.result || {};
        showMessage(`Tested ${r.name || mirrorId}: ${r.status} (${r.latencyMs || 0}ms)${r.migrated ? ` -> Migrated to ${r.domain}` : ''}`);
      }
    } catch (err) {
      showMessage(`Probe error: ${err.message}`);
    } finally {
      setCheckingMirrorId(null);
    }
  };

  // Toggle mirror enabled/disabled
  const handleToggleEnabled = async (mirror) => {
    try {
      const updated = await updateMirrorSource(mirror.id, { isEnabled: !mirror.isEnabled });
      if (updated && updated.data) {
        setMirrors(prev => prev.map(m => m.id === mirror.id ? updated.data : m));
      }
    } catch (err) {
      showMessage(`Failed to toggle: ${err.message}`);
    }
  };

  // Start inline editing
  const handleStartEdit = (mirror) => {
    setEditingMirrorId(mirror.id);
    setEditFormData({
      currentDomain: mirror.currentDomain,
      candidateDomainsStr: (mirror.candidateDomains || []).join(', ')
    });
  };

  // Save inline domain edit
  const handleSaveEdit = async (mirrorId) => {
    try {
      const candArray = editFormData.candidateDomainsStr
        .split(',')
        .map(s => s.trim().replace(/^https?:\/\//, '').replace(/\/.*$/, ''))
        .filter(Boolean);

      const payload = {
        currentDomain: editFormData.currentDomain.trim().replace(/^https?:\/\//, '').replace(/\/.*$/, ''),
        candidateDomains: candArray.length > 0 ? candArray : [editFormData.currentDomain.trim()]
      };

      const res = await updateMirrorSource(mirrorId, payload);
      if (res && res.data) {
        setMirrors(prev => prev.map(m => m.id === mirrorId ? res.data : m));
        setEditingMirrorId(null);
        showMessage(`Updated domain configuration for ${res.data.name}`);
      }
    } catch (err) {
      showMessage(`Save error: ${err.message}`);
    }
  };

  // Add new mirror item
  const handleCreateMirror = async (e) => {
    e.preventDefault();
    if (!newMirrorForm.name || !newMirrorForm.currentDomain || !newMirrorForm.searchTemplate) {
      showMessage('Please fill required fields (Name, Domain, Search Template)');
      return;
    }

    try {
      const candArray = (newMirrorForm.candidateDomains || '')
        .split(',')
        .map(s => s.trim().replace(/^https?:\/\//, '').replace(/\/.*$/, ''))
        .filter(Boolean);

      const payload = {
        ...newMirrorForm,
        currentDomain: newMirrorForm.currentDomain.trim().replace(/^https?:\/\//, '').replace(/\/.*$/, ''),
        candidateDomains: candArray.length > 0 ? candArray : [newMirrorForm.currentDomain.trim()]
      };

      const res = await saveMirrorSource(payload);
      if (res && res.data) {
        setMirrors(prev => [...prev, res.data]);
        setShowAddModal(false);
        setNewMirrorForm({
          name: '',
          category: 'Anime',
          type: 'Stream',
          quality: '1080p HD',
          audio: 'Dual Audio & Multi-Sub',
          currentDomain: '',
          candidateDomains: '',
          searchTemplate: 'https://{domain}/search?q={query}',
          directUrlTemplate: 'https://{domain}/'
        });
        showMessage(`Added mirror source "${res.data.name}"`);
      }
    } catch (err) {
      showMessage(`Create error: ${err.message}`);
    }
  };

  // Delete mirror
  const handleDeleteMirror = async (mirrorId) => {
    if (!confirm('Are you sure you want to remove this mirror source?')) return;
    try {
      await deleteMirrorSourceItem(mirrorId);
      setMirrors(prev => prev.filter(m => m.id !== mirrorId));
      showMessage('Mirror source removed');
    } catch (err) {
      showMessage(`Delete error: ${err.message}`);
    }
  };

  // Filter mirrors by category and search
  const filteredMirrors = mirrors.filter(m => {
    if (mirrorCategoryFilter !== 'All') {
      if (mirrorCategoryFilter === 'Download') {
        if (m.type !== 'Download' && m.type !== 'Both') return false;
      } else if (m.category !== mirrorCategoryFilter && m.category !== 'All') {
        return false;
      }
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const inName = (m.name || '').toLowerCase().includes(q);
      const inDomain = (m.currentDomain || '').toLowerCase().includes(q);
      const inCandidates = (m.candidateDomains || []).some(c => c.toLowerCase().includes(q));
      if (!inName && !inDomain && !inCandidates) return false;
    }
    return true;
  });

  const workingCount = mirrors.filter(m => m.status === 'Working').length;
  const offlineCount = mirrors.filter(m => m.status === 'Offline').length;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/85 backdrop-blur-md animate-fade-in"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-5xl max-h-[90vh] bg-zinc-950 rounded-3xl overflow-hidden border border-zinc-800 shadow-2xl flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="p-4 sm:p-6 pb-4 border-b border-zinc-800 flex items-center justify-between shrink-0 bg-zinc-950/80">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-red-600/10 text-red-500 border border-red-500/20">
              <Server className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-black text-white flex items-center gap-2">
                OmniWatch Control Center
                <span className="text-[10px] bg-red-950 text-red-400 font-bold px-2 py-0.5 rounded-full border border-red-800/40">
                  v2.0
                </span>
              </h3>
              <p className="text-xs text-zinc-400">
                Dynamic Domain Registry, Failover Health & Upstream Providers
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-full text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation Tabs */}
        <div className="px-6 pt-2 border-b border-zinc-800 flex items-center justify-between gap-4 bg-zinc-900/40 shrink-0">
          <div className="flex items-center gap-6">
            <button
              onClick={() => setActiveTab('mirrors')}
              className={`pb-3 text-xs sm:text-sm font-extrabold uppercase tracking-wider transition-all border-b-2 flex items-center gap-2 ${
                activeTab === 'mirrors'
                  ? 'text-red-500 border-red-500'
                  : 'text-zinc-400 border-transparent hover:text-zinc-200'
              }`}
            >
              <Globe className="w-4 h-4" />
              <span>Dynamic Mirror Registry ({mirrors.length})</span>
            </button>

            <button
              onClick={() => setActiveTab('system')}
              className={`pb-3 text-xs sm:text-sm font-extrabold uppercase tracking-wider transition-all border-b-2 flex items-center gap-2 ${
                activeTab === 'system'
                  ? 'text-red-500 border-red-500'
                  : 'text-zinc-400 border-transparent hover:text-zinc-200'
              }`}
            >
              <Database className="w-4 h-4" />
              <span>Storage & Providers</span>
            </button>
          </div>

          {activeTab === 'mirrors' && (
            <div className="flex items-center gap-2 pb-2">
              <button
                onClick={() => setShowAddModal(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold bg-zinc-800 hover:bg-zinc-700 text-white border border-zinc-700 transition-all hover:scale-105 active:scale-95"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Custom Site</span>
              </button>

              <button
                onClick={handleCheckAll}
                disabled={isCheckingAll}
                className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-bold bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 transition-all hover:scale-105 active:scale-95 disabled:opacity-50"
              >
                <RotateCw className={`w-3.5 h-3.5 ${isCheckingAll ? 'animate-spin text-amber-400' : 'text-amber-400'}`} />
                <span>{isCheckingAll ? 'Verifying All...' : '⚡ Verify All Domains'}</span>
              </button>
            </div>
          )}
        </div>

        {/* Feedback Alert Bar */}
        {actionMessage && (
          <div className="px-6 py-2 bg-zinc-900 border-b border-zinc-800 text-xs text-amber-300 flex items-center gap-2 animate-fade-in shrink-0">
            <Sparkles className="w-4 h-4 text-amber-400 shrink-0" />
            <span>{actionMessage}</span>
          </div>
        )}

        {/* Scrollable Content Body */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-6 flex-1 scrollbar-thin">

          {/* TAB 1: DYNAMIC MIRRORS REGISTRY */}
          {activeTab === 'mirrors' && (
            <div className="space-y-5 animate-fade-in">
              {/* Stats & Search Toolbar */}
              <div className="p-4 rounded-2xl bg-zinc-900/60 border border-zinc-800 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-bold text-zinc-300">
                      Total Configured: <strong className="text-white">{mirrors.length}</strong>
                    </span>
                    <span className="px-2 py-0.5 rounded-md text-[11px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                      ● {workingCount} Responsive
                    </span>
                    {offlineCount > 0 && (
                      <span className="px-2 py-0.5 rounded-md text-[11px] font-bold bg-rose-500/10 text-rose-400 border border-rose-500/30">
                        ● {offlineCount} Offline / Blocked
                      </span>
                    )}
                  </div>

                  {/* Search Input */}
                  <div className="relative w-full sm:w-64">
                    <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
                    <input
                      type="text"
                      placeholder="Search site or domain..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full pl-9 pr-3 py-1.5 bg-zinc-950 border border-zinc-800 rounded-xl text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-red-500"
                    />
                  </div>
                </div>

                {/* Category Pills */}
                <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-zinc-800/80">
                  {['All', 'Anime', 'Movie', 'Series', 'Download'].map((cat) => (
                    <button
                      key={cat}
                      onClick={() => setMirrorCategoryFilter(cat)}
                      className={`px-3 py-1 rounded-full text-xs font-bold transition-all ${
                        mirrorCategoryFilter === cat
                          ? 'bg-zinc-800 text-white shadow-sm ring-1 ring-zinc-600'
                          : 'bg-zinc-950 hover:bg-zinc-900 text-zinc-400 hover:text-zinc-200 border border-zinc-800'
                      }`}
                    >
                      {cat === 'All' ? 'All Categories' : cat}
                    </button>
                  ))}
                </div>
              </div>

              {/* Dynamic Mirrors Grid */}
              <div className="space-y-3">
                {filteredMirrors.length > 0 ? (
                  filteredMirrors.map((mirror) => {
                    const isEditing = editingMirrorId === mirror.id;
                    const isCheckingThis = checkingMirrorId === mirror.id;

                    return (
                      <div
                        key={mirror.id}
                        className={`p-4 rounded-2xl border transition-all ${
                          !mirror.isEnabled
                            ? 'bg-zinc-950/40 border-zinc-900 opacity-60'
                            : mirror.status === 'Working'
                            ? 'bg-zinc-900/60 border-zinc-800 hover:border-zinc-700'
                            : 'bg-zinc-950/80 border-rose-950/60'
                        }`}
                      >
                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                          {/* Left: Name, Badges, Category */}
                          <div className="space-y-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <h4 className="text-sm font-bold text-white flex items-center gap-2">
                                {mirror.name}
                                {!mirror.isEnabled && (
                                  <span className="text-[10px] text-zinc-500 font-normal italic">
                                    (Disabled)
                                  </span>
                                )}
                              </h4>

                              <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-zinc-800 text-zinc-300 border border-zinc-700">
                                {mirror.category}
                              </span>

                              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${
                                mirror.type === 'Download'
                                  ? 'bg-blue-950/80 text-blue-300 border border-blue-800/60'
                                  : 'bg-emerald-950/80 text-emerald-300 border border-emerald-800/60'
                              }`}>
                                {mirror.type}
                              </span>

                              {/* Status Badge */}
                              {mirror.status === 'Working' ? (
                                <span className="flex items-center gap-1.5 text-[10.5px] font-bold text-emerald-400 bg-emerald-950/70 border border-emerald-500/40 px-2 py-0.5 rounded-full">
                                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                                  <span>Responsive</span>
                                  {mirror.latencyMs > 0 && <span>({mirror.latencyMs}ms)</span>}
                                </span>
                              ) : (
                                <span className="flex items-center gap-1.5 text-[10.5px] font-bold text-rose-400 bg-rose-950/70 border border-rose-500/40 px-2 py-0.5 rounded-full">
                                  <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
                                  <span>Offline / Failover</span>
                                </span>
                              )}
                            </div>

                            {/* Active Domain Info */}
                            {!isEditing ? (
                              <div className="flex flex-wrap items-center gap-2 pt-1 text-xs text-zinc-400">
                                <span className="font-semibold text-zinc-300">Active Domain:</span>
                                <a
                                  href={`https://${mirror.currentDomain}/`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-red-400 hover:text-red-300 font-mono font-bold flex items-center gap-1 underline underline-offset-2"
                                  title="Visit domain root"
                                >
                                  <span>{mirror.currentDomain}</span>
                                  <ExternalLink className="w-3 h-3" />
                                </a>

                                {mirror.candidateDomains?.length > 1 && (
                                  <span className="text-[11px] text-zinc-500 flex items-center gap-1">
                                    <span>• Fallbacks:</span>
                                    <span className="font-mono text-zinc-400">
                                      {mirror.candidateDomains.filter(d => d !== mirror.currentDomain).join(', ')}
                                    </span>
                                  </span>
                                )}
                              </div>
                            ) : (
                              /* Inline Editing Mode */
                              <div className="space-y-2 pt-2">
                                <div className="flex flex-wrap items-center gap-2">
                                  <label className="text-[11px] font-bold text-zinc-300">Active Domain:</label>
                                  <input
                                    type="text"
                                    value={editFormData.currentDomain}
                                    onChange={(e) => setEditFormData({ ...editFormData, currentDomain: e.target.value })}
                                    className="px-2.5 py-1 bg-zinc-950 border border-zinc-700 rounded-lg text-xs font-mono text-white focus:outline-none focus:border-red-500"
                                  />
                                </div>
                                <div className="flex flex-wrap items-center gap-2">
                                  <label className="text-[11px] font-bold text-zinc-300">Candidate Fallbacks (comma separated):</label>
                                  <input
                                    type="text"
                                    value={editFormData.candidateDomainsStr}
                                    onChange={(e) => setEditFormData({ ...editFormData, candidateDomainsStr: e.target.value })}
                                    placeholder="domain1.to, domain2.org, domain3.nz"
                                    className="w-full sm:w-80 px-2.5 py-1 bg-zinc-950 border border-zinc-700 rounded-lg text-xs font-mono text-white focus:outline-none focus:border-red-500"
                                  />
                                </div>
                                <div className="flex items-center gap-2 pt-1">
                                  <button
                                    onClick={() => handleSaveEdit(mirror.id)}
                                    className="px-3 py-1 rounded-lg text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white flex items-center gap-1"
                                  >
                                    <Check className="w-3.5 h-3.5" />
                                    <span>Save Changes</span>
                                  </button>
                                  <button
                                    onClick={() => setEditingMirrorId(null)}
                                    className="px-3 py-1 rounded-lg text-xs font-bold bg-zinc-800 hover:bg-zinc-700 text-zinc-300"
                                  >
                                    Cancel
                                  </button>
                                </div>
                              </div>
                            )}

                            {/* Status note if available */}
                            {mirror.statusNote && !isEditing && (
                              <p className="text-[11px] text-zinc-500 italic pt-0.5">
                                {mirror.statusNote}
                              </p>
                            )}
                          </div>

                          {/* Right: Actions */}
                          {!isEditing && (
                            <div className="flex items-center gap-2 shrink-0 pt-2 md:pt-0">
                              {/* Live Ping Button */}
                              <button
                                onClick={() => handleCheckSingle(mirror.id)}
                                disabled={isCheckingThis}
                                className="flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-bold bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border border-zinc-700 transition-all hover:scale-105 active:scale-95 disabled:opacity-50"
                                title="Probe domain reachability right now"
                              >
                                <RotateCw className={`w-3.5 h-3.5 ${isCheckingThis ? 'animate-spin text-amber-400' : 'text-zinc-400'}`} />
                                <span>{isCheckingThis ? 'Checking...' : 'Ping'}</span>
                              </button>

                              {/* Edit Button */}
                              <button
                                onClick={() => handleStartEdit(mirror)}
                                className="p-1.5 rounded-xl text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors border border-transparent hover:border-zinc-700"
                                title="Edit domain & candidate fallbacks"
                              >
                                <Edit2 className="w-4 h-4" />
                              </button>

                              {/* Enable/Disable Toggle */}
                              <button
                                onClick={() => handleToggleEnabled(mirror)}
                                className={`px-2.5 py-1 rounded-xl text-[11px] font-bold border transition-colors ${
                                  mirror.isEnabled
                                    ? 'bg-emerald-950/60 text-emerald-300 border-emerald-800/60 hover:bg-emerald-900/60'
                                    : 'bg-zinc-800 text-zinc-400 border-zinc-700 hover:bg-zinc-700'
                                }`}
                                title={mirror.isEnabled ? 'Disable in UI' : 'Enable in UI'}
                              >
                                {mirror.isEnabled ? 'Enabled' : 'Disabled'}
                              </button>

                              {/* Delete if custom */}
                              {mirror.id.startsWith('custom_') && (
                                <button
                                  onClick={() => handleDeleteMirror(mirror.id)}
                                  className="p-1.5 rounded-xl text-zinc-500 hover:text-rose-400 hover:bg-zinc-800 transition-colors"
                                  title="Delete custom mirror"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <div className="p-8 text-center rounded-2xl bg-zinc-900/40 border border-zinc-800 text-zinc-400 text-xs">
                    No mirrors match your filter. Try another category or search query.
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 2: STORAGE & UPSTREAM PROVIDERS */}
          {activeTab === 'system' && (
            <div className="space-y-6 animate-fade-in">
              {/* Database Health Card */}
              <div className="p-4 rounded-2xl bg-zinc-900/60 border border-zinc-800 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider text-zinc-300 flex items-center gap-1.5">
                    <Database className="w-4 h-4 text-emerald-400" />
                    Relational Storage (SQLite WAL)
                  </span>
                  <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                    ONLINE
                  </span>
                </div>
                <p className="text-xs text-zinc-400">
                  Engine: <span className="text-zinc-200 font-semibold">{db.engine || 'SQLite (node:sqlite WAL mode)'}</span>
                </p>
                <div className="flex items-center gap-4 text-xs text-zinc-400 pt-1">
                  <span>Tracked Titles: <strong className="text-white">{db.trackedTitlesCount || 0}</strong></span>
                  <span>Episodes Logged: <strong className="text-white">{db.watchedEpisodesCount || 0}</strong></span>
                </div>
              </div>

              {/* Upstream Providers Matrix */}
              <div className="space-y-3">
                <h4 className="text-xs font-bold uppercase tracking-wider text-zinc-400">
                  Connected Public Metadata Providers
                </h4>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  {/* AniList */}
                  <div className="p-3.5 rounded-xl bg-zinc-900/60 border border-zinc-800 flex items-center justify-between">
                    <div>
                      <span className="font-bold text-white">AniList GraphQL</span>
                      <p className="text-[11px] text-zinc-400">Anime, Schedules & Native Titles</p>
                    </div>
                    <span className="flex items-center gap-1 text-[11px] font-bold text-emerald-400">
                      <CheckCircle className="w-3.5 h-3.5" />
                      Active
                    </span>
                  </div>

                  {/* TVMaze */}
                  <div className="p-3.5 rounded-xl bg-zinc-900/60 border border-zinc-800 flex items-center justify-between">
                    <div>
                      <span className="font-bold text-white">TVMaze API</span>
                      <p className="text-[11px] text-zinc-400">TV Shows, Seasons & Episode Stills</p>
                    </div>
                    <span className="flex items-center gap-1 text-[11px] font-bold text-emerald-400">
                      <CheckCircle className="w-3.5 h-3.5" />
                      Active
                    </span>
                  </div>

                  {/* Kitsu */}
                  <div className="p-3.5 rounded-xl bg-zinc-900/60 border border-zinc-800 flex items-center justify-between">
                    <div>
                      <span className="font-bold text-white">Kitsu JSON:API</span>
                      <p className="text-[11px] text-zinc-400">Anime Search & Video Trailers</p>
                    </div>
                    <span className="flex items-center gap-1 text-[11px] font-bold text-emerald-400">
                      <CheckCircle className="w-3.5 h-3.5" />
                      Active
                    </span>
                  </div>

                  {/* TMDB */}
                  <div className="p-3.5 rounded-xl bg-zinc-900/60 border border-zinc-800 flex items-center justify-between">
                    <div>
                      <span className="font-bold text-white">TMDB & JustWatch</span>
                      <p className="text-[11px] text-zinc-400">Movies, TV & Watch Availability</p>
                    </div>
                    {providers.tmdb?.active ? (
                      <span className="flex items-center gap-1 text-[11px] font-bold text-emerald-400">
                        <CheckCircle className="w-3.5 h-3.5" />
                        Connected
                      </span>
                    ) : (
                      <span className="flex items-center gap-1 text-[11px] font-bold text-amber-400">
                        <AlertCircle className="w-3.5 h-3.5" />
                        Optional Key
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* TMDB Info notice */}
              {!providers.tmdb?.active && (
                <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-xs text-amber-200 space-y-1.5">
                  <div className="flex items-center gap-2 font-bold text-amber-300">
                    <Key className="w-4 h-4" />
                    <span>Optional: Unlock Live TMDB Movies & JustWatch Providers</span>
                  </div>
                  <p className="text-zinc-300 leading-relaxed text-[11px]">
                    OmniWatch works out of the box with AniList, TVMaze, and Kitsu. To also query TMDB's full movie database and official JustWatch streaming availability, simply add your free TMDB API key to <code className="bg-zinc-900 px-1 py-0.5 rounded text-amber-300 font-mono">apps/server/.env</code> as <code className="bg-zinc-900 px-1 py-0.5 rounded text-amber-300 font-mono">TMDB_API_KEY=your_key</code> and save!
                  </p>
                  <a
                    href="https://www.themoviedb.org/settings/api"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-amber-400 hover:text-amber-300 font-semibold underline text-[11px] mt-1"
                  >
                    <span>Get Free TMDB API Key</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-4 sm:p-5 border-t border-zinc-800 flex items-center justify-between bg-zinc-950 shrink-0">
          <span className="text-[11px] text-zinc-500">
            {mirrors.length} mirrors configured in central database
          </span>
          <button
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-white text-xs font-bold transition-colors"
          >
            Close
          </button>
        </div>
      </div>

      {/* Add Custom Mirror Modal Popup */}
      {showAddModal && (
        <div
          className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in"
          onClick={() => setShowAddModal(false)}
        >
          <div
            className="w-full max-w-lg bg-zinc-950 rounded-2xl border border-zinc-800 shadow-2xl p-6 space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-3 border-b border-zinc-800">
              <h4 className="text-base font-bold text-white flex items-center gap-2">
                <Plus className="w-4 h-4 text-red-500" />
                Add New Dynamic Mirror Site
              </h4>
              <button
                onClick={() => setShowAddModal(false)}
                className="text-zinc-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateMirror} className="space-y-3 text-xs">
              <div>
                <label className="block text-zinc-300 font-bold mb-1">Site Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. CineHub Stream"
                  value={newMirrorForm.name}
                  onChange={(e) => setNewMirrorForm({ ...newMirrorForm, name: e.target.value })}
                  className="w-full px-3 py-2 bg-zinc-900 border border-zinc-700 rounded-xl text-white focus:outline-none focus:border-red-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-zinc-300 font-bold mb-1">Category</label>
                  <select
                    value={newMirrorForm.category}
                    onChange={(e) => setNewMirrorForm({ ...newMirrorForm, category: e.target.value })}
                    className="w-full px-3 py-2 bg-zinc-900 border border-zinc-700 rounded-xl text-white focus:outline-none"
                  >
                    <option value="Anime">Anime</option>
                    <option value="Movie">Movie</option>
                    <option value="Series">Series</option>
                    <option value="All">All Categories</option>
                  </select>
                </div>

                <div>
                  <label className="block text-zinc-300 font-bold mb-1">Type</label>
                  <select
                    value={newMirrorForm.type}
                    onChange={(e) => setNewMirrorForm({ ...newMirrorForm, type: e.target.value })}
                    className="w-full px-3 py-2 bg-zinc-900 border border-zinc-700 rounded-xl text-white focus:outline-none"
                  >
                    <option value="Stream">Stream</option>
                    <option value="Download">Download</option>
                    <option value="Both">Both</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-zinc-300 font-bold mb-1">Current Active Domain *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. cinehub.to (without https://)"
                  value={newMirrorForm.currentDomain}
                  onChange={(e) => setNewMirrorForm({ ...newMirrorForm, currentDomain: e.target.value })}
                  className="w-full px-3 py-2 bg-zinc-900 border border-zinc-700 rounded-xl text-white font-mono focus:outline-none focus:border-red-500"
                />
              </div>

              <div>
                <label className="block text-zinc-300 font-bold mb-1">Candidate Backup Fallback Domains</label>
                <input
                  type="text"
                  placeholder="e.g. cinehub.to, cinehub.is, cinehub.bz (comma-separated)"
                  value={newMirrorForm.candidateDomains}
                  onChange={(e) => setNewMirrorForm({ ...newMirrorForm, candidateDomains: e.target.value })}
                  className="w-full px-3 py-2 bg-zinc-900 border border-zinc-700 rounded-xl text-white font-mono focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-zinc-300 font-bold mb-1">Search URL Template *</label>
                <input
                  type="text"
                  required
                  placeholder="https://{domain}/search?q={query}"
                  value={newMirrorForm.searchTemplate}
                  onChange={(e) => setNewMirrorForm({ ...newMirrorForm, searchTemplate: e.target.value })}
                  className="w-full px-3 py-2 bg-zinc-900 border border-zinc-700 rounded-xl text-white font-mono focus:outline-none"
                />
                <p className="text-[10px] text-zinc-500 mt-1">
                  Use placeholders: &#123;domain&#125;, &#123;query&#125;, &#123;slug&#125;
                </p>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-zinc-800">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-bold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-red-600 hover:bg-red-500 text-white font-bold"
                >
                  Add Site to Registry
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
