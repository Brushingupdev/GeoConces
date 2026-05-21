"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

type Tab = "perfil" | "alertas";

type Profile = { id: number; email: string; full_name?: string | null; phone?: string | null };
type AlertRule = {
  id: number;
  name: string;
  rule_type: string;
  filters?: Record<string, unknown> | null;
  channels?: string[] | null;
  is_active: boolean;
};

export default function ConfiguracionPage() {
  const [tab, setTab] = useState<Tab>("perfil");

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Configuración</h1>
      <div className="flex gap-2 border-b mb-6">
        {(["perfil", "alertas"] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition ${
              tab === t
                ? "border-primary-600 text-primary-600"
                : "border-transparent text-slate-500 hover:text-slate-700"
            }`}
          >
            {t === "perfil" ? "Perfil" : "Reglas de alerta"}
          </button>
        ))}
      </div>

      {tab === "perfil" && <PerfilTab />}
      {tab === "alertas" && <AlertasTab />}
    </div>
  );
}

function PerfilTab() {
  const qc = useQueryClient();
  const { data: me } = useQuery<Profile>({
    queryKey: ["me"],
    queryFn: async () => (await api.get("/users/me")).data,
  });

  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [savedMsg, setSavedMsg] = useState<string | null>(null);

  useEffect(() => {
    if (me) {
      setFullName(me.full_name || "");
      setPhone(me.phone || "");
    }
  }, [me]);

  const updateProfile = useMutation({
    mutationFn: async () =>
      (await api.patch("/users/me", { full_name: fullName, phone })).data,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["me"] });
      setSavedMsg("Perfil actualizado");
      setTimeout(() => setSavedMsg(null), 2000);
    },
  });

  const [currentPwd, setCurrentPwd] = useState("");
  const [newPwd, setNewPwd] = useState("");
  const [pwdError, setPwdError] = useState<string | null>(null);
  const [pwdOk, setPwdOk] = useState<string | null>(null);

  const changePwd = useMutation({
    mutationFn: async () => {
      setPwdError(null);
      setPwdOk(null);
      await api.post("/users/me/password", { current_password: currentPwd, new_password: newPwd });
    },
    onSuccess: () => {
      setCurrentPwd("");
      setNewPwd("");
      setPwdOk("Contraseña actualizada");
    },
    onError: (err: any) =>
      setPwdError(err?.response?.data?.detail || "Error al cambiar contraseña"),
  });

  return (
    <div className="space-y-6 max-w-xl">
      <div className="bg-white p-6 rounded-xl border shadow-sm">
        <h2 className="font-semibold mb-4">Datos de perfil</h2>
        <div className="space-y-3">
          <div>
            <label className="block text-sm text-slate-600 mb-1">Email</label>
            <input
              type="email"
              value={me?.email || ""}
              disabled
              className="w-full px-4 py-2 border rounded-lg bg-slate-50 text-slate-500"
            />
          </div>
          <div>
            <label className="block text-sm text-slate-600 mb-1">Nombre completo</label>
            <input
              type="text"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>
          <div>
            <label className="block text-sm text-slate-600 mb-1">Teléfono</label>
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>
          <button
            onClick={() => updateProfile.mutate()}
            disabled={updateProfile.isPending}
            className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50"
          >
            Guardar cambios
          </button>
          {savedMsg && <p className="text-sm text-emerald-600">{savedMsg}</p>}
        </div>
      </div>

      <div className="bg-white p-6 rounded-xl border shadow-sm">
        <h2 className="font-semibold mb-4">Cambiar contraseña</h2>
        <div className="space-y-3">
          <input
            type="password"
            placeholder="Contraseña actual"
            value={currentPwd}
            onChange={(e) => setCurrentPwd(e.target.value)}
            className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
          />
          <input
            type="password"
            placeholder="Nueva contraseña (mín. 8 caracteres)"
            value={newPwd}
            onChange={(e) => setNewPwd(e.target.value)}
            className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
          />
          <button
            onClick={() => changePwd.mutate()}
            disabled={changePwd.isPending || !currentPwd || newPwd.length < 8}
            className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50"
          >
            Actualizar contraseña
          </button>
          {pwdError && <p className="text-sm text-red-600">{pwdError}</p>}
          {pwdOk && <p className="text-sm text-emerald-600">{pwdOk}</p>}
        </div>
      </div>
    </div>
  );
}

const RULE_TYPES = [
  { value: "expiration", label: "Vencimiento próximo" },
  { value: "status_change", label: "Cambio de estado" },
  { value: "payment", label: "Pago pendiente" },
];

const CHANNELS = ["email", "in_app", "whatsapp"];

function AlertasTab() {
  const qc = useQueryClient();
  const { data: rules } = useQuery<AlertRule[]>({
    queryKey: ["alert-rules"],
    queryFn: async () => (await api.get("/alerts/rules")).data,
  });

  const [name, setName] = useState("");
  const [ruleType, setRuleType] = useState("expiration");
  const [channels, setChannels] = useState<string[]>(["in_app"]);

  const createRule = useMutation({
    mutationFn: async () =>
      (await api.post("/alerts/rules", {
        name,
        rule_type: ruleType,
        channels,
        is_active: true,
      })).data,
    onSuccess: () => {
      setName("");
      qc.invalidateQueries({ queryKey: ["alert-rules"] });
    },
  });

  const toggleRule = useMutation({
    mutationFn: async (rule: AlertRule) =>
      (await api.patch(`/alerts/rules/${rule.id}`, {
        name: rule.name,
        rule_type: rule.rule_type,
        filters: rule.filters,
        channels: rule.channels,
        is_active: !rule.is_active,
      })).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["alert-rules"] }),
  });

  const deleteRule = useMutation({
    mutationFn: async (id: number) => api.delete(`/alerts/rules/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["alert-rules"] }),
  });

  const toggleChannel = (c: string) =>
    setChannels((prev) => (prev.includes(c) ? prev.filter((x) => x !== c) : [...prev, c]));

  return (
    <div className="space-y-6">
      <div className="bg-white p-6 rounded-xl border shadow-sm max-w-xl">
        <h2 className="font-semibold mb-4">Nueva regla de alerta</h2>
        <div className="space-y-3">
          <input
            type="text"
            placeholder="Nombre de la regla"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
          />
          <select
            value={ruleType}
            onChange={(e) => setRuleType(e.target.value)}
            className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
          >
            {RULE_TYPES.map((r) => (
              <option key={r.value} value={r.value}>{r.label}</option>
            ))}
          </select>
          <div>
            <label className="block text-sm text-slate-600 mb-2">Canales</label>
            <div className="flex gap-3">
              {CHANNELS.map((c) => (
                <label key={c} className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={channels.includes(c)}
                    onChange={() => toggleChannel(c)}
                  />
                  <span className="capitalize">{c.replace("_", " ")}</span>
                </label>
              ))}
            </div>
          </div>
          <button
            onClick={() => name.trim() && createRule.mutate()}
            disabled={!name.trim() || createRule.isPending}
            className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50"
          >
            Crear regla
          </button>
        </div>
      </div>

      <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
        <table className="w-full text-sm text-left">
          <thead className="bg-slate-50 text-slate-600 uppercase text-xs">
            <tr>
              <th className="px-6 py-3">Nombre</th>
              <th className="px-6 py-3">Tipo</th>
              <th className="px-6 py-3">Canales</th>
              <th className="px-6 py-3">Estado</th>
              <th className="px-6 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {rules?.map((r) => (
              <tr key={r.id} className="border-t">
                <td className="px-6 py-3 font-medium">{r.name}</td>
                <td className="px-6 py-3">
                  {RULE_TYPES.find((t) => t.value === r.rule_type)?.label || r.rule_type}
                </td>
                <td className="px-6 py-3">{(r.channels || []).join(", ") || "-"}</td>
                <td className="px-6 py-3">
                  <span className={`px-2 py-0.5 text-xs rounded-full ${
                    r.is_active ? "bg-emerald-100 text-emerald-700" : "bg-slate-200 text-slate-700"
                  }`}>
                    {r.is_active ? "Activa" : "Pausada"}
                  </span>
                </td>
                <td className="px-6 py-3 space-x-3">
                  <button
                    onClick={() => toggleRule.mutate(r)}
                    className="text-primary-600 hover:underline text-xs"
                  >
                    {r.is_active ? "Pausar" : "Activar"}
                  </button>
                  <button
                    onClick={() => deleteRule.mutate(r.id)}
                    className="text-red-600 hover:underline text-xs"
                  >
                    Eliminar
                  </button>
                </td>
              </tr>
            ))}
            {rules?.length === 0 && (
              <tr>
                <td className="px-6 py-6 text-slate-500" colSpan={5}>
                  No tienes reglas de alerta configuradas.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
