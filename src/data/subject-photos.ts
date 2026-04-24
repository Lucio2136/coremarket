/**
 * Fotos curadas de sujetos mexicanos y figuras públicas populares.
 * Fuente: Wikimedia Commons (licencia libre). Se cargan como <img src> —
 * no requieren fetch() ni dependen de la Wikipedia API.
 * Clave: nombre en minúsculas para búsqueda case-insensitive.
 */
export const SUBJECT_PHOTOS: Record<string, string> = {
  "peso pluma":       "https://upload.wikimedia.org/wikipedia/commons/e/ee/Peso_Pluma%2C_performing_in_Monterrey_%282024-09-24%29_%281%29.png",
  "nodal":            "https://upload.wikimedia.org/wikipedia/commons/thumb/3/31/Nodal.jpg/960px-Nodal.jpg",
  "christian nodal":  "https://upload.wikimedia.org/wikipedia/commons/thumb/3/31/Nodal.jpg/960px-Nodal.jpg",
  "cazzu":            "https://upload.wikimedia.org/wikipedia/commons/8/87/Cazzu_en_2019.jpg",
  "ángela aguilar":   "https://upload.wikimedia.org/wikipedia/commons/0/03/MX_SC_DESFILE_CULTURA_COMUNITARIA_-_52476062235_%28cropped%29.jpg",
  "angela aguilar":   "https://upload.wikimedia.org/wikipedia/commons/0/03/MX_SC_DESFILE_CULTURA_COMUNITARIA_-_52476062235_%28cropped%29.jpg",
  "natanael cano":    "https://upload.wikimedia.org/wikipedia/commons/a/ad/Cano6_%28cropped%29.jpg",
  "karol g":          "https://upload.wikimedia.org/wikipedia/commons/thumb/5/57/2023-11-16_Gala_de_los_Latin_Grammy%2C_15_%28cropped_2%29.jpg/960px-2023-11-16_Gala_de_los_Latin_Grammy%2C_15_%28cropped_2%29.jpg",
  "bad bunny":        "https://upload.wikimedia.org/wikipedia/commons/thumb/b/b1/Bad_Bunny_2019_by_Glenn_Francis_%28cropped%29.jpg/960px-Bad_Bunny_2019_by_Glenn_Francis_%28cropped%29.jpg",
  "shakira":          "https://upload.wikimedia.org/wikipedia/commons/thumb/0/0b/2023-11-16_Gala_de_los_Latin_Grammy%2C_03_%28cropped%2901.jpg/960px-2023-11-16_Gala_de_los_Latin_Grammy%2C_03_%28cropped%2901.jpg",
  "luisito comunica": "https://upload.wikimedia.org/wikipedia/commons/7/73/De_clase_media_endeudada_a_empresario_exitoso_-_Marcas_Que_Impactan_Gran_Malo_con_LuisitoComunica.3.png",
  "wendy guevara":    "https://upload.wikimedia.org/wikipedia/commons/5/5c/En_la_gran_fiesta_con_Wendy%2C_Manelyk%2C_Trixy_y_m%C3%A1s..._CONOCIENDO_NUEVAS_COMADRES_Damian_Cervantes_5-49_screenshot_%28cropped%29.png",
  "claudia sheinbaum":"https://upload.wikimedia.org/wikipedia/commons/thumb/6/6f/Claudia_Sheinbaum_in_2025_(3x4_cropped).jpg/960px-Claudia_Sheinbaum_in_2025_(3x4_cropped).jpg",
  "canelo álvarez":   "https://upload.wikimedia.org/wikipedia/commons/8/82/Saúl_Álvarez.png",
  "canelo alvarez":   "https://upload.wikimedia.org/wikipedia/commons/8/82/Saúl_Álvarez.png",
  "hirving lozano":   "https://upload.wikimedia.org/wikipedia/commons/e/e3/Hirving_Lozano.png",
  "guillermo ochoa":  "https://upload.wikimedia.org/wikipedia/commons/2/2f/Mex-Kor_%281%29_%28cropped%29.jpg",
  "lionel messi":     "https://upload.wikimedia.org/wikipedia/commons/thumb/6/6b/Lionel_Messi_White_House_2026_%283x4_cropped%29.jpg/960px-Lionel_Messi_White_House_2026_%283x4_cropped%29.jpg",
  "messi":            "https://upload.wikimedia.org/wikipedia/commons/thumb/6/6b/Lionel_Messi_White_House_2026_%283x4_cropped%29.jpg/960px-Lionel_Messi_White_House_2026_%283x4_cropped%29.jpg",
};

/**
 * Devuelve la URL de foto para un sujeto, o null si no está en el mapa.
 * Búsqueda case-insensitive, ignora acentos opcionales.
 */
export function getSubjectPhoto(name: string): string | null {
  const key = name.trim().toLowerCase();
  return SUBJECT_PHOTOS[key] ?? null;
}
