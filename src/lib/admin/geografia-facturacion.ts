const porNombre = (a: string, b: string) => a.localeCompare(b, "es-CL");

export const comunasValparaiso = [
  // Valparaíso
  "Valparaíso", "Casablanca", "Concón", "Juan Fernández", "Puchuncaví", "Quintero", "Viña del Mar",
  // Isla de Pascua
  "Isla de Pascua",
  // Los Andes
  "Los Andes", "Calle Larga", "Rinconada", "San Esteban",
  // Petorca
  "La Ligua", "Cabildo", "Papudo", "Petorca", "Zapallar",
  // Quillota
  "Quillota", "Calera", "Hijuelas", "La Cruz", "Nogales",
  // San Antonio
  "San Antonio", "Algarrobo", "Cartagena", "El Quisco", "El Tabo", "Santo Domingo",
  // San Felipe de Aconcagua
  "San Felipe", "Catemu", "Llaillay", "Panquehue", "Putaendo", "Santa María",
  // Marga Marga
  "Quilpué", "Limache", "Olmué", "Villa Alemana",
].sort(porNombre);

export const ciudadesYLocalidadesValparaiso = [
  "Valparaíso", "Viña del Mar", "Concón", "Quilpué", "Villa Alemana", "Quillota",
  "Placilla", "Curauma", "Laguna Verde", "Reñaca", "Peñablanca", "El Belloto", "Colliguay",
  "Limache", "Olmué", "La Calera", "La Cruz", "Hijuelas", "Nogales", "El Melón", "San Pedro",
  "Casablanca", "Quintay", "Lo Vásquez", "Quintero", "Loncura", "Puchuncaví", "Ventanas",
  "Horcón", "Maitencillo", "Zapallar", "Cachagua", "Papudo", "La Ligua", "Cabildo", "Petorca",
  "San Antonio", "Llolleo", "Cartagena", "Las Cruces", "El Tabo", "El Quisco", "Isla Negra",
  "Algarrobo", "Santo Domingo", "San Felipe", "Los Andes", "Calle Larga", "Rinconada",
  "San Esteban", "Catemu", "Llay Llay", "Panquehue", "Putaendo", "Santa María",
  "Hanga Roa", "San Juan Bautista",
].sort(porNombre);
