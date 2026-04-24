/**
 * Fotos curadas de sujetos mexicanos y figuras públicas populares.
 * Fuente: Wikimedia Commons (licencia libre). Se cargan como <img src> —
 * no requieren fetch() ni dependen de la Wikipedia API.
 * Clave: nombre en minúsculas para búsqueda case-insensitive.
 */
export const SUBJECT_PHOTOS: Record<string, string> = {

  // ── Música ────────────────────────────────────────────────────────────────
  "peso pluma":        "https://upload.wikimedia.org/wikipedia/commons/e/ee/Peso_Pluma%2C_performing_in_Monterrey_%282024-09-24%29_%281%29.png",
  "nodal":             "https://upload.wikimedia.org/wikipedia/commons/thumb/3/31/Nodal.jpg/960px-Nodal.jpg",
  "christian nodal":   "https://upload.wikimedia.org/wikipedia/commons/thumb/3/31/Nodal.jpg/960px-Nodal.jpg",
  "cazzu":             "https://upload.wikimedia.org/wikipedia/commons/8/87/Cazzu_en_2019.jpg",
  "ángela aguilar":    "https://upload.wikimedia.org/wikipedia/commons/0/03/MX_SC_DESFILE_CULTURA_COMUNITARIA_-_52476062235_%28cropped%29.jpg",
  "angela aguilar":    "https://upload.wikimedia.org/wikipedia/commons/0/03/MX_SC_DESFILE_CULTURA_COMUNITARIA_-_52476062235_%28cropped%29.jpg",
  "natanael cano":     "https://upload.wikimedia.org/wikipedia/commons/a/ad/Cano6_%28cropped%29.jpg",
  "karol g":           "https://upload.wikimedia.org/wikipedia/commons/thumb/5/57/2023-11-16_Gala_de_los_Latin_Grammy%2C_15_%28cropped_2%29.jpg/960px-2023-11-16_Gala_de_los_Latin_Grammy%2C_15_%28cropped_2%29.jpg",
  "bad bunny":         "https://upload.wikimedia.org/wikipedia/commons/thumb/b/b1/Bad_Bunny_2019_by_Glenn_Francis_%28cropped%29.jpg/960px-Bad_Bunny_2019_by_Glenn_Francis_%28cropped%29.jpg",
  "shakira":           "https://upload.wikimedia.org/wikipedia/commons/thumb/0/0b/2023-11-16_Gala_de_los_Latin_Grammy%2C_03_%28cropped%2901.jpg/960px-2023-11-16_Gala_de_los_Latin_Grammy%2C_03_%28cropped%2901.jpg",
  "luisito comunica":  "https://upload.wikimedia.org/wikipedia/commons/7/73/De_clase_media_endeudada_a_empresario_exitoso_-_Marcas_Que_Impactan_Gran_Malo_con_LuisitoComunica.3.png",
  "wendy guevara":     "https://upload.wikimedia.org/wikipedia/commons/5/5c/En_la_gran_fiesta_con_Wendy%2C_Manelyk%2C_Trixy_y_m%C3%A1s..._CONOCIENDO_NUEVAS_COMADRES_Damian_Cervantes_5-49_screenshot_%28cropped%29.png",

  // ── Política — Personas ───────────────────────────────────────────────────
  "claudia sheinbaum":           "https://upload.wikimedia.org/wikipedia/commons/thumb/6/6f/Claudia_Sheinbaum_in_2025_(3x4_cropped).jpg/960px-Claudia_Sheinbaum_in_2025_(3x4_cropped).jpg",
  "andrés manuel lópez obrador": "https://upload.wikimedia.org/wikipedia/commons/thumb/1/13/01.10.2024_-_Cerim%C3%B4nia_de_transmiss%C3%A3o_do_Poder_Executivo_Federal_%2854036093388%29_%28cropped%29.jpg/960px-01.10.2024_-_Cerim%C3%B4nia_de_transmiss%C3%A3o_do_Poder_Executivo_Federal_%2854036093388%29_%28cropped%29.jpg",
  "andres manuel lopez obrador": "https://upload.wikimedia.org/wikipedia/commons/thumb/1/13/01.10.2024_-_Cerim%C3%B4nia_de_transmiss%C3%A3o_do_Poder_Executivo_Federal_%2854036093388%29_%28cropped%29.jpg/960px-01.10.2024_-_Cerim%C3%B4nia_de_transmiss%C3%A3o_do_Poder_Executivo_Federal_%2854036093388%29_%28cropped%29.jpg",
  "amlo":                        "https://upload.wikimedia.org/wikipedia/commons/thumb/1/13/01.10.2024_-_Cerim%C3%B4nia_de_transmiss%C3%A3o_do_Poder_Executivo_Federal_%2854036093388%29_%28cropped%29.jpg/960px-01.10.2024_-_Cerim%C3%B4nia_de_transmiss%C3%A3o_do_Poder_Executivo_Federal_%2854036093388%29_%28cropped%29.jpg",
  "xóchitl gálvez":              "https://upload.wikimedia.org/wikipedia/commons/thumb/1/16/X%C3%B3chitl_G%C3%A1lvez_mayo_2024_%28cropped%29.jpg/960px-X%C3%B3chitl_G%C3%A1lvez_mayo_2024_%28cropped%29.jpg",
  "xochitl galvez":              "https://upload.wikimedia.org/wikipedia/commons/thumb/1/16/X%C3%B3chitl_G%C3%A1lvez_mayo_2024_%28cropped%29.jpg/960px-X%C3%B3chitl_G%C3%A1lvez_mayo_2024_%28cropped%29.jpg",
  "marcelo ebrard":              "https://upload.wikimedia.org/wikipedia/commons/thumb/5/5c/Marcelo_Ebrard_en_la_conferencia_matutina_%28cropped%29.jpg/960px-Marcelo_Ebrard_en_la_conferencia_matutina_%28cropped%29.jpg",
  "ricardo anaya":               "https://upload.wikimedia.org/wikipedia/commons/thumb/d/d3/Ricardo_Anaya_%28cropped_3%29.jpg/960px-Ricardo_Anaya_%28cropped_3%29.jpg",
  "samuel garcía":               "https://upload.wikimedia.org/wikipedia/commons/thumb/3/36/Samuel_Garc%C3%ADa_en_2022_-_cropped.jpg/960px-Samuel_Garc%C3%ADa_en_2022_-_cropped.jpg",
  "samuel garcia":               "https://upload.wikimedia.org/wikipedia/commons/thumb/3/36/Samuel_Garc%C3%ADa_en_2022_-_cropped.jpg/960px-Samuel_Garc%C3%ADa_en_2022_-_cropped.jpg",
  "clara brugada":               "https://upload.wikimedia.org/wikipedia/commons/thumb/8/87/Clara_Marina_Brugada_Molina_%28cropped%29_2.jpg/960px-Clara_Marina_Brugada_Molina_%28cropped%29_2.jpg",
  "cuauhtémoc blanco":           "https://upload.wikimedia.org/wikipedia/commons/a/ae/Cuauhtemoc_Blanco_2.jpg",
  "cuauhtemoc blanco":           "https://upload.wikimedia.org/wikipedia/commons/a/ae/Cuauhtemoc_Blanco_2.jpg",
  "jorge álvarez máynez":        "https://upload.wikimedia.org/wikipedia/commons/thumb/0/0c/Jorge_%C3%81lvarez_M%C3%A1ynez_%28cropped%29.jpg/960px-Jorge_%C3%81lvarez_M%C3%A1ynez_%28cropped%29.jpg",
  "jorge alvarez maynez":        "https://upload.wikimedia.org/wikipedia/commons/thumb/0/0c/Jorge_%C3%81lvarez_M%C3%A1ynez_%28cropped%29.jpg/960px-Jorge_%C3%81lvarez_M%C3%A1ynez_%28cropped%29.jpg",
  "alejandro moreno":            "https://upload.wikimedia.org/wikipedia/commons/thumb/5/51/Alejandro_Alito_Moreno_%28cropped%29.jpg/960px-Alejandro_Alito_Moreno_%28cropped%29.jpg",
  "alejandro moreno cárdenas":   "https://upload.wikimedia.org/wikipedia/commons/thumb/5/51/Alejandro_Alito_Moreno_%28cropped%29.jpg/960px-Alejandro_Alito_Moreno_%28cropped%29.jpg",
  "alejandro moreno cardenas":   "https://upload.wikimedia.org/wikipedia/commons/thumb/5/51/Alejandro_Alito_Moreno_%28cropped%29.jpg/960px-Alejandro_Alito_Moreno_%28cropped%29.jpg",
  "alito moreno":                "https://upload.wikimedia.org/wikipedia/commons/thumb/5/51/Alejandro_Alito_Moreno_%28cropped%29.jpg/960px-Alejandro_Alito_Moreno_%28cropped%29.jpg",
  "mario delgado":               "https://upload.wikimedia.org/wikipedia/commons/thumb/a/aa/Mario_Delgado_%28portrait%29.jpg/960px-Mario_Delgado_(portrait).jpg",
  "mario delgado carrillo":      "https://upload.wikimedia.org/wikipedia/commons/thumb/a/aa/Mario_Delgado_%28portrait%29.jpg/960px-Mario_Delgado_(portrait).jpg",
  "martí batres":                "https://upload.wikimedia.org/wikipedia/commons/thumb/e/e8/Mart%C3%AD_Batres.jpg/960px-Mart%C3%AD_Batres.jpg",
  "marti batres":                "https://upload.wikimedia.org/wikipedia/commons/thumb/e/e8/Mart%C3%AD_Batres.jpg/960px-Mart%C3%AD_Batres.jpg",
  "adán augusto lópez":          "https://upload.wikimedia.org/wikipedia/commons/thumb/f/ff/Adán_Augusto_López_en_Morelia.jpg/960px-Adán_Augusto_López_en_Morelia.jpg",
  "adan augusto lopez":          "https://upload.wikimedia.org/wikipedia/commons/thumb/f/ff/Adán_Augusto_López_en_Morelia.jpg/960px-Adán_Augusto_López_en_Morelia.jpg",

  // ── Política — Partidos ───────────────────────────────────────────────────
  "pan":                               "https://upload.wikimedia.org/wikipedia/commons/thumb/f/ff/PAN_%28Mexico%29_2025_logo.svg/960px-PAN_%28Mexico%29_2025_logo.svg.png",
  "partido acción nacional":           "https://upload.wikimedia.org/wikipedia/commons/thumb/f/ff/PAN_%28Mexico%29_2025_logo.svg/960px-PAN_%28Mexico%29_2025_logo.svg.png",
  "partido accion nacional":           "https://upload.wikimedia.org/wikipedia/commons/thumb/f/ff/PAN_%28Mexico%29_2025_logo.svg/960px-PAN_%28Mexico%29_2025_logo.svg.png",
  "pri":                               "https://upload.wikimedia.org/wikipedia/commons/thumb/b/b5/PRI_logo_%28Mexico%29.svg/960px-PRI_logo_%28Mexico%29.svg.png",
  "partido revolucionario institucional": "https://upload.wikimedia.org/wikipedia/commons/thumb/b/b5/PRI_logo_%28Mexico%29.svg/960px-PRI_logo_%28Mexico%29.svg.png",
  "prd":                               "https://upload.wikimedia.org/wikipedia/commons/thumb/8/8f/PRD_logo_%28Mexico%29.svg/960px-PRD_logo_%28Mexico%29.svg.png",
  "partido de la revolución democrática": "https://upload.wikimedia.org/wikipedia/commons/thumb/8/8f/PRD_logo_%28Mexico%29.svg/960px-PRD_logo_%28Mexico%29.svg.png",
  "partido de la revolucion democratica": "https://upload.wikimedia.org/wikipedia/commons/thumb/8/8f/PRD_logo_%28Mexico%29.svg/960px-PRD_logo_%28Mexico%29.svg.png",
  "morena":                            "https://upload.wikimedia.org/wikipedia/commons/thumb/e/e4/Logotipo_Morena.svg/960px-Logotipo_Morena.svg.png",
  "movimiento regeneración nacional":  "https://upload.wikimedia.org/wikipedia/commons/thumb/e/e4/Logotipo_Morena.svg/960px-Logotipo_Morena.svg.png",
  "mc":                                "https://upload.wikimedia.org/wikipedia/commons/thumb/a/a6/Logotipo_Movimiento_Ciudadano.svg/960px-Logotipo_Movimiento_Ciudadano.svg.png",
  "movimiento ciudadano":              "https://upload.wikimedia.org/wikipedia/commons/thumb/a/a6/Logotipo_Movimiento_Ciudadano.svg/960px-Logotipo_Movimiento_Ciudadano.svg.png",

  // ── Deportes ──────────────────────────────────────────────────────────────
  "canelo álvarez":    "https://upload.wikimedia.org/wikipedia/commons/8/82/Saúl_Álvarez.png",
  "canelo alvarez":    "https://upload.wikimedia.org/wikipedia/commons/8/82/Saúl_Álvarez.png",
  "hirving lozano":    "https://upload.wikimedia.org/wikipedia/commons/e/e3/Hirving_Lozano.png",
  "guillermo ochoa":   "https://upload.wikimedia.org/wikipedia/commons/2/2f/Mex-Kor_%281%29_%28cropped%29.jpg",
  "lionel messi":      "https://upload.wikimedia.org/wikipedia/commons/thumb/6/6b/Lionel_Messi_White_House_2026_%283x4_cropped%29.jpg/960px-Lionel_Messi_White_House_2026_%283x4_cropped%29.jpg",
  "messi":             "https://upload.wikimedia.org/wikipedia/commons/thumb/6/6b/Lionel_Messi_White_House_2026_%283x4_cropped%29.jpg/960px-Lionel_Messi_White_House_2026_%283x4_cropped%29.jpg",

};

/**
 * Devuelve la URL de foto para un sujeto, o null si no está en el mapa.
 * Búsqueda case-insensitive.
 */
export function getSubjectPhoto(name: string): string | null {
  const key = name.trim().toLowerCase();
  return SUBJECT_PHOTOS[key] ?? null;
}
