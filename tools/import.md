# Cómo convertir material nuevo en JSON

1. Pasa a la IA el material (texto, foto del examen, PDF) junto con este archivo.
2. Pídele: "Convierte esto a un array JSON siguiendo el esquema de `tools/import.md`".
3. Guarda el resultado como `content/<tema>.json` (un archivo por unidad/RA).
4. Ejecuta `npm run validate`. Corrige lo que marque (campos vacíos, ids duplicados).
5. Sube los cambios a GitHub: Actions generará un APK nuevo.

## Esquema de cada ítem

```json
{
  "id": "hw-0015",
  "ra": ["RA2"],
  "topic": "hardware",
  "en": "docking station",
  "es": "base de conexión (dock)",
  "pos": "noun",
  "example_en": "The docking station connects the laptop to several peripherals.",
  "example_es": "La base de conexión conecta el portátil a varios periféricos.",
  "image": "img/docking-station.svg",
  "difficulty": 2,
  "source": "aula-virtual"
}
```

## Reglas

- `id`: prefijo del tema + número de 4 cifras, único en toda la carpeta (`hw-`, `vb-`, `md-`, `dd-`...).
- `ra`: lista con `RA1`–`RA5`.
- `topic`: `hardware`, `assembly-verbs`, `modules-jobs`, `daily-work` u otro nuevo (aparece solo en la app).
- `pos`: `noun`, `verb`, `adjective`, `phrase`...
- `example_en`: frase técnica corta y natural, nivel A2-B1.
- `es`: traducción solo al español.
- `image` es opcional: solo si el dibujo ayuda a entender sin la traducción. Archivo SVG en `public/img/`.
- `difficulty`: 1 (fácil) a 5 (difícil).
- `source`: `aula-virtual`, `examenes`, `programacion`, `lectura`...

## Otros tipos de contenido (por prefijo del `id`)

| Prefijo | Qué es | Archivo de ejemplo |
|---|---|---|
| `rd-` | Lectura con T/F, preguntas abiertas y sinónimos | `content/reading.json` |
| `ls-` | Listening (guion leído por voz, T/F, ideas, elección múltiple) | `content/listening.json` |
| `dl-` | Diálogo con traducción por línea | `content/dialogues.json` |
| `ex-` | Ejercicios tipo examen: `match`, `wordbank`, `gapbank` | `content/exercises.json` |
| `gr-` | Lección de gramática con regla, ejemplos y ejercicios | `content/grammar.json` |
| `wr-` | Tarea de writing con checklist (`must`, `forbid`) y modelo | `content/writing.json` |

Cualquier otro prefijo (por ejemplo `av-`) se trata como vocabulario. Copia la forma de un ítem existente y ejecuta `npm run validate`.
