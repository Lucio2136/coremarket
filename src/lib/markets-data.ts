export interface Market {
  id: string;
  title: string;
  subjectName: string;
  subjectPhoto: string;
  category: string;
  yesOdds: number;
  noOdds: number;
  totalPool: number;
  bettorCount: number;
  closesAt: Date;
  status: "open" | "closed" | "resolved";
  result: "yes" | "no" | null;
  yesPercent: number;
  isTrending: boolean;
}

const now = Date.now();
const day = 86400000;

export const sampleMarkets: Market[] = [
  {
    id: "1",
    title: 'Donald Trump usará la palabra "GUERRA" en un discurso público esta semana',
    subjectName: "Donald Trump",
    subjectPhoto: "",
    category: "politics",
    yesOdds: 2.4,
    noOdds: 1.6,
    totalPool: 875000,
    bettorCount: 1243,
    closesAt: new Date(now + 5 * day),
    status: "open",
    result: null,
    yesPercent: 62,
    isTrending: true,
  },
  {
    id: "2",
    title: "Elon Musk publicará más de 10 tweets sobre IA esta semana",
    subjectName: "Elon Musk",
    subjectPhoto: "",
    category: "business",
    yesOdds: 1.8,
    noOdds: 2.1,
    totalPool: 578000,
    bettorCount: 876,
    closesAt: new Date(now + 3 * day),
    status: "open",
    result: null,
    yesPercent: 71,
    isTrending: true,
  },
  {
    id: "3",
    title: "Taylor Swift anunciará un nuevo álbum en abril 2026",
    subjectName: "Taylor Swift",
    subjectPhoto: "",
    category: "entertainment",
    yesOdds: 3.2,
    noOdds: 1.3,
    totalPool: 1210000,
    bettorCount: 2105,
    closesAt: new Date(now + 28 * day),
    status: "open",
    result: null,
    yesPercent: 34,
    isTrending: true,
  },
  {
    id: "4",
    title: "Argentina ganará su próximo partido",
    subjectName: "Argentina NT",
    subjectPhoto: "",
    category: "sports",
    yesOdds: 1.5,
    noOdds: 2.8,
    totalPool: 384000,
    bettorCount: 654,
    closesAt: new Date(now + 2 * day),
    status: "open",
    result: null,
    yesPercent: 78,
    isTrending: false,
  },
  {
    id: "5",
    title: "Apple anunciará un nuevo producto este mes",
    subjectName: "Apple Inc.",
    subjectPhoto: "",
    category: "business",
    yesOdds: 2.0,
    noOdds: 1.9,
    totalPool: 1005000,
    bettorCount: 1532,
    closesAt: new Date(now + 18 * day),
    status: "open",
    result: null,
    yesPercent: 52,
    isTrending: false,
  },
  {
    id: "6",
    title: "Biden respaldará a un candidato para 2028 este mes",
    subjectName: "Joe Biden",
    subjectPhoto: "",
    category: "politics",
    yesOdds: 4.5,
    noOdds: 1.2,
    totalPool: 277000,
    bettorCount: 412,
    closesAt: new Date(now + 14 * day),
    status: "open",
    result: null,
    yesPercent: 22,
    isTrending: false,
  },
];

export const categories = [
  { id: "home", label: "Inicio", icon: "Home" },
  { id: "trending", label: "Tendencias", icon: "Flame" },
  { id: "politics", label: "Política", icon: "Flag" },
  { id: "business", label: "Negocios / CEOs", icon: "Briefcase" },
  { id: "entertainment", label: "Entretenimiento", icon: "Clapperboard" },
  { id: "sports", label: "Deportes", icon: "Trophy" },
  { id: "world", label: "Líderes Mundiales", icon: "Globe" },
  { id: "weekly", label: "Especiales Semanales", icon: "Calendar" },
  { id: "mybets", label: "Mis Apuestas", icon: "Coins" },
  { id: "profile", label: "Perfil", icon: "User" },
] as const;
