"use client";
import { useEffect, useState } from "react";
type Option = { id?: number; name: string };
export default function VehicleFields({ vehicle, year, make, model, onYear, onMake, onModel }: {
  vehicle: string; year: string; make: string; model: string;
  onYear: (value: string) => void; onMake: (value: string) => void; onModel: (value: string) => void;
}) {
  const [makes, setMakes] = useState<Option[]>([]);
  const [models, setModels] = useState<Option[]>([]);
  const [makeStatus, setMakeStatus] = useState("");
  const [modelStatus, setModelStatus] = useState("");
  const makeId = makes.find(item => item.name.toLowerCase() === make.trim().toLowerCase())?.id;
  useEffect(() => {
    const controller = new AbortController();
    setMakes([]); setMakeStatus("Loading makes…");
    fetch(`/api/shop-finder/vehicles?vehicle=${encodeURIComponent(vehicle)}`, { signal: controller.signal })
      .then(async r => { if (!r.ok) throw Error(); return r.json(); })
      .then(d => { setMakes(d.options); setMakeStatus(""); })
      .catch(() => { if (!controller.signal.aborted) setMakeStatus("Suggestions unavailable. Type your make and model below."); });
    return () => controller.abort();
  }, [vehicle]);
  useEffect(() => {
    const controller = new AbortController();
    setModels([]); setModelStatus("");
    if (!makeId || !year || +year < 1996) return () => controller.abort();
    setModelStatus("Loading models…");
    fetch(`/api/shop-finder/vehicles?vehicle=${encodeURIComponent(vehicle)}&make=${makeId}&year=${year}`, { signal: controller.signal })
      .then(async r => { if (!r.ok) throw Error(); return r.json(); })
      .then(d => { setModels(d.options); setModelStatus(d.options.length ? "" : "No model suggestions for this selection. Enter yours below."); })
      .catch(() => { if (!controller.signal.aborted) setModelStatus("Model suggestions unavailable. Enter yours below."); });
    return () => controller.abort();
  }, [vehicle, makeId, year]);
  return <>
    <div className="grid3">
      <label className="field">Year<input inputMode="numeric" list="vehicle-years" placeholder="e.g. 2020" maxLength={4} value={year} onChange={e => { onYear(e.target.value.replace(/\D/g, "")); onModel(""); }}/></label>
      <datalist id="vehicle-years">{Array.from({length: new Date().getFullYear() + 2 - 1950}, (_, i) => new Date().getFullYear() + 1 - i).map(y => <option key={y} value={y}/>)}</datalist>
      <label className="field">Make<input list="vehicle-makes" placeholder="Choose or type make" maxLength={150} value={make} onChange={e => { onMake(e.target.value); onModel(""); }}/></label>
      <datalist id="vehicle-makes">{makes.map(m => <option key={m.id} value={m.name}/>)}</datalist>
      <label className="field">Model<input list="vehicle-models" placeholder="Choose or type model" maxLength={150} value={model} onChange={e => onModel(e.target.value)}/></label>
      <datalist id="vehicle-models">{models.map(m => <option key={m.name} value={m.name}/>)}</datalist>
    </div>
    <p className="small" aria-live="polite">{makeStatus || modelStatus || "Choose a suggestion or type your own vehicle details. All years welcome."}</p>
  </>;
}
