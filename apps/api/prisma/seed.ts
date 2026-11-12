// Seeds reference data, one demo account per role and realistic activity across the 10 districts,
// so every screen looks alive on first run. Deterministic: the same data every time.
//
//   tsx prisma/seed.ts            wipe nothing, insert everything (use on an empty database)
//   tsx prisma/seed.ts --if-empty skip when users already exist (used by `npm run dev`)
import { PrismaClient, type Prisma } from '@prisma/client';
import {
  REFERENCE,
  activeCrop,
  hash,
  matchPests,
  rng,
  seasonFor,
  type FarmProfile,
  type Season,
} from '@fieldwise/shared';
import '../src/env.js';
import { DEMO_ACCOUNTS } from '../src/demo.js';
import { seedReference } from '../src/lib/reference.js';
import { toJson } from '../src/lib/json.js';

const FARMERS: Record<string, string[]> = {
  ludhiana: ['Gurpreet Singh', 'Harjit Kaur', 'Balwinder Sandhu', 'Manjit Gill', 'Sukhdev Brar'],
  nagpur: ['Ramesh Wankhede', 'Sunita Bhoyar', 'Prakash Thakre', 'Vandana Raut', 'Ganesh Kale'],
  cuttack: ['Bijay Sahoo', 'Sabita Behera', 'Prasanta Mohanty', 'Ranjita Das', 'Ashok Nayak'],
  jodhpur: ['Mohan Lal Bishnoi', 'Kamla Devi', 'Ramesh Choudhary', 'Bhanwar Singh', 'Sita Jat'],
  dharwad: ['Basavaraj Patil', 'Shobha Hiremath', 'Mallikarjun Kulkarni', 'Savita Angadi', 'Shivanand Desai'],
  varanasi: ['Rajesh Yadav', 'Geeta Devi', 'Shiv Kumar Maurya', 'Anita Patel', 'Ramashankar Singh'],
  indore: ['Mahesh Patidar', 'Rekha Chouhan', 'Dinesh Malviya', 'Kavita Yadav', 'Suresh Mukati'],
  coimbatore: [
    'Murugan Karuppan',
    'Lakshmi Ramasamy',
    'Senthil Kumar',
    'Selvi Palanisamy',
    'Karthik Subramaniam',
  ],
  bardhaman: ['Subhash Ghosh', 'Mamata Mondal', 'Tapan Roy', 'Rina Bag', 'Gour Hazra'],
  rajkot: ['Jayesh Patel', 'Hansa Vaghasiya', 'Bharat Gajera', 'Manju Savaliya', 'Kishor Ladani'],
};
const OFFICERS: Record<string, string> = {
  ludhiana: 'Navdeep Kaur',
  nagpur: 'Anita Deshmukh',
  cuttack: 'Debasis Mishra',
  jodhpur: 'Pooja Rathore',
  dharwad: 'Raghavendra Joshi',
  varanasi: 'Alok Tripathi',
  indore: 'Neha Sharma',
  coimbatore: 'Priya Natarajan',
  bardhaman: 'Sourav Banerjee',
  rajkot: 'Dhaval Mehta',
};

// Question templates by category. {crop} is replaced with the crop name.
const QUESTIONS: { category: string; q: string; a: string }[] = [
  {
    category: 'pest',
    q: 'Small holes in {crop} leaves and caterpillars inside the whorl. What should I spray?',
    a: 'This looks like fall armyworm or a borer. Put sand and lime (9:1) in the whorl and set up 8 pheromone traps per acre. If more than 10% of plants are hit, spray emamectin benzoate 5 SG at 0.4 g per litre.',
  },
  {
    category: 'disease',
    q: 'Brown spots spreading on lower {crop} leaves after the rain.',
    a: 'Likely a leaf spot or early blight. Remove the worst leaves and spray mancozeb 75 WP at 2.5 g per litre. Avoid watering in the evening.',
  },
  {
    category: 'nutrient',
    q: 'My {crop} is pale yellow and growing slowly. Do I need more urea?',
    a: 'Pale, slow plants usually mean low nitrogen. Top-dress 20 kg urea per acre when the soil is moist, or spray 2% urea. Check your Soil Health Card before the next season.',
  },
  {
    category: 'water',
    q: 'How often should I irrigate {crop} in this heat?',
    a: 'Water when the top 5 cm of soil is dry, usually every 7 to 8 days on your soil. Irrigate early morning and check the Weather page for the next suggested date.',
  },
  {
    category: 'market',
    q: 'Mandi price for {crop} dropped this week. Should I sell now or wait?',
    a: 'Prices across the district are softening. If you have dry, safe storage, hold for 1–2 weeks. If the price falls below MSP, sell at the government procurement centre.',
  },
  {
    category: 'pest',
    q: 'Sticky leaves and tiny insects under the {crop} leaves.',
    a: 'These are aphids or whitefly. Spray neem oil at 5 ml per litre with a little soap, and put up yellow sticky traps. Spare the ladybird beetles.',
  },
  {
    category: 'disease',
    q: 'White powder on {crop} leaves in the mornings.',
    a: 'This is powdery mildew. Spray wettable sulphur 80 WP at 2.5 g per litre. Buttermilk diluted 1:10 also helps at the first sign.',
  },
  {
    category: 'other',
    q: 'Which variety of {crop} should I sow for my black soil?',
    a: 'Ask at your Krishi Vigyan Kendra for the locally recommended varieties. Pick a short-duration one if your irrigation is limited.',
  },
];

const DAY = 86_400_000;

export async function seed(prisma: Prisma.TransactionClient, now = new Date()): Promise<void> {
  const r = rng(hash('fieldwise-seed-v2'));
  const between = (a: number, b: number) => a + r() * (b - a);
  const pickOne = <T>(xs: readonly T[]): T => xs[Math.floor(r() * xs.length)]!;
  const season: Season = seasonFor(now);

  await seedReference(prisma);

  // --- people
  const users: Record<string, { id: string; name: string; district: string }[]> = {};
  const officers: Record<string, string> = {};
  for (const a of DEMO_ACCOUNTS) {
    const u = await prisma.user.create({
      data: { phone: a.phone, name: a.name, role: a.role, districtId: a.districtId },
    });
    if (a.role === 'farmer')
      (users[a.districtId!] ??= []).push({ id: u.id, name: u.name, district: a.districtId! });
    if (a.role === 'officer') officers[a.districtId!] = u.id;
  }
  let phoneN = 9800000100;
  for (const [district, names] of Object.entries(FARMERS)) {
    if (!officers[district]) {
      const o = await prisma.user.create({
        data: { phone: `+91${phoneN++}`, name: OFFICERS[district]!, role: 'officer', districtId: district },
      });
      officers[district] = o.id;
    }
    for (const name of names) {
      if (users[district]?.some((u) => u.name === name)) continue;
      const u = await prisma.user.create({
        data: {
          phone: `+91${phoneN++}`,
          name,
          role: 'farmer',
          districtId: district,
          lang: r() < 0.5 ? 'hi' : 'en',
        },
      });
      (users[district] ??= []).push({ id: u.id, name, district });
    }
  }

  // --- farms and Soil Health Card history
  const farms: {
    id: string;
    owner: string;
    district: string;
    crop: string;
    lat: number;
    lon: number;
    village: string;
  }[] = [];
  for (const [district, list] of Object.entries(users)) {
    const D = REFERENCE.districts[district]!;
    const dist = await prisma.district.findUniqueOrThrow({ where: { id: district } });
    for (const [i, u] of list.entries()) {
      const nFarms = i === 0 ? 2 : r() < 0.3 ? 2 : 1;
      for (let f = 0; f < nFarms; f++) {
        const soil = r() < 0.8 ? D.soil : pickOne(Object.keys(REFERENCE.soils));
        const irrigation = pickOne(['none', 'partial', 'partial', 'full'] as const);
        const shc = {
          ph: +(D.ph + between(-0.5, 0.5)).toFixed(1),
          N: Math.round(between(180, 420)),
          P: Math.round(between(7, 28)),
          K: Math.round(between(90, 340)),
        };
        const area = +pickOne([0.75, 1, 1.5, 2, 2.5, 3, 4, 5]).toFixed(2);
        const profile: FarmProfile = { district, season, soil, irrigation, area, ...shc };
        const crop = activeCrop(profile, null, REFERENCE).id;
        // The demo farmer's first farm keeps the legacy demo profile so the walkthrough matches.
        const demo = u.name === 'Ramesh Wankhede' && f === 0;
        const lat = dist.lat + between(-0.25, 0.25);
        const lon = dist.lon + between(-0.25, 0.25);
        const village = pickOne(D.mk);
        const farm = await prisma.farm.create({
          data: {
            ownerId: u.id,
            name: demo ? 'Home field' : f === 0 ? 'Main field' : 'River plot',
            districtId: district,
            village: demo ? 'Katol' : village,
            lat,
            lon,
            soil: demo ? 'black' : soil,
            irrigation: demo ? 'partial' : irrigation,
            areaAcres: demo ? 2 : area,
            season,
            crop: demo
              ? activeCrop(
                  {
                    ...profile,
                    soil: 'black',
                    irrigation: 'partial',
                    area: 2,
                    ph: 7.6,
                    N: 240,
                    P: 14,
                    K: 310,
                  },
                  null,
                  REFERENCE,
                ).id
              : crop,
          },
        });
        // Three yearly cards; the latest is the current reading. Nitrogen and pH drift a little each year.
        const latest = demo ? { ph: 7.6, N: 240, P: 14, K: 310 } : shc;
        for (let y = 2; y >= 0; y--) {
          const drift = y * 0.6;
          await prisma.soilTest.create({
            data: {
              farmId: farm.id,
              testedAt: new Date(now.getFullYear() - y, 4, 10 + Math.floor(r() * 15)),
              ph: +(latest.ph - drift * 0.1 + between(-0.1, 0.1)).toFixed(1),
              n: Math.round(latest.N + drift * 25 + between(-10, 10)),
              p: Math.round(latest.P + drift * 1.5 + between(-1, 1)),
              k: Math.round(latest.K - drift * 8 + between(-8, 8)),
            },
          });
        }
        farms.push({ id: farm.id, owner: u.id, district, crop: farm.crop!, lat, lon, village: farm.village });
      }
    }
  }

  // --- pest reports, clustered around a few hotspots per district over the last 60 days
  for (const district of Object.keys(users)) {
    const local = farms.filter((f) => f.district === district);
    const hotspots = local.slice(0, 3);
    for (let k = 0; k < 18; k++) {
      const at = pickOne(hotspots);
      const pests = REFERENCE.pests.filter((p) => p.c.includes(at.crop));
      const pest = pests.length ? pickOne(pests) : REFERENCE.pests.at(-1)!;
      await prisma.pestReport.create({
        data: {
          districtId: district,
          farmId: at.id,
          pestId: pest.id,
          lat: at.lat + between(-0.06, 0.06),
          lon: at.lon + between(-0.06, 0.06),
          source: pickOne(['diagnosis', 'diagnosis', 'officer', 'ticket']),
          reportedAt: new Date(now.getTime() - between(0, 60) * DAY),
        },
      });
    }
  }

  // --- advisory desk tickets
  const cropName = (id: string) =>
    REFERENCE.crops
      .find((c) => c.id === id)!
      .n.en.split(' (')[0]!
      .toLowerCase();
  for (const district of Object.keys(users)) {
    const local = farms.filter((f) => f.district === district);
    const n = district === 'nagpur' ? 6 : 4;
    for (let k = 0; k < n; k++) {
      const farm = local[k % local.length]!;
      const tpl = QUESTIONS[(hash(district) + k) % QUESTIONS.length]!;
      const createdAt = new Date(now.getTime() - between(0.1, 12) * DAY);
      const status = k === 0 ? 'open' : k === 1 ? 'open' : k < n - 1 ? 'answered' : 'closed';
      const t = await prisma.ticket.create({
        data: {
          farmerId: farm.owner,
          farmId: farm.id,
          districtId: district,
          crop: farm.crop,
          subject: tpl.q.replace('{crop}', cropName(farm.crop)),
          category: tpl.category,
          status,
          officerId: status === 'open' ? null : officers[district],
          createdAt,
          updatedAt: createdAt,
        },
      });
      await prisma.ticketMessage.create({
        data: { ticketId: t.id, authorId: farm.owner, body: t.subject, createdAt },
      });
      if (status !== 'open') {
        const at = new Date(createdAt.getTime() + between(2, 20) * 3600_000);
        await prisma.ticketMessage.create({
          data: { ticketId: t.id, authorId: officers[district]!, body: tpl.a, createdAt: at },
        });
        await prisma.ticket.update({ where: { id: t.id }, data: { updatedAt: at } });
      }
    }
  }

  // --- alerts
  const alerts = [
    {
      districtId: 'nagpur',
      cropId: 'chickpea',
      level: 'warn',
      labels: {
        en: 'Pod borer moths rising in chickpea fields around Nagpur. Put up bird perches and pheromone traps this week.',
        hi: 'नागपुर के आसपास चने के खेतों में फली छेदक पतंगे बढ़ रहे हैं। इस सप्ताह पक्षी ठिकाने और फेरोमोन ट्रैप लगाएँ।',
      },
      ago: 1 / 24,
    },
    {
      districtId: 'ludhiana',
      cropId: 'wheat',
      level: 'warn',
      labels: {
        en: 'Yellow rust reported in wheat near Khanna. Scout fields twice a week and report yellow stripes.',
        hi: 'खन्ना के पास गेहूँ में पीला रतुआ दिखा है। सप्ताह में दो बार खेत जाँचें और पीली धारियाँ दिखें तो बताएँ।',
      },
      ago: 2,
    },
    {
      districtId: 'cuttack',
      cropId: null,
      level: 'info',
      labels: {
        en: 'Soil Health Card camp at Kendrapara block office on Saturday, 10 am to 4 pm.',
        hi: 'शनिवार को केंद्रापाड़ा प्रखंड कार्यालय में मृदा स्वास्थ्य कार्ड शिविर, सुबह 10 से शाम 4 बजे तक।',
      },
      ago: 3,
    },
    {
      districtId: null,
      cropId: null,
      level: 'info',
      labels: {
        en: 'PM-KISAN: check that your bank account is linked to Aadhaar before the next instalment.',
        hi: 'पीएम-किसान: अगली किस्त से पहले जाँच लें कि आपका बैंक खाता आधार से जुड़ा है।',
      },
      ago: 5,
    },
  ];
  for (const a of alerts) {
    const authorId = a.districtId
      ? officers[a.districtId]!
      : (await prisma.user.findUniqueOrThrow({ where: { phone: DEMO_ACCOUNTS[2].phone } })).id;
    await prisma.alert.create({
      data: {
        authorId,
        districtId: a.districtId,
        cropId: a.cropId,
        level: a.level,
        labels: toJson(a.labels),
        createdAt: new Date(now.getTime() - a.ago * DAY),
      },
    });
  }

  // --- a few notifications for the demo farmer
  const demoFarmer = await prisma.user.findUniqueOrThrow({ where: { phone: DEMO_ACCOUNTS[0].phone } });
  const answered = await prisma.ticket.findFirst({ where: { farmerId: demoFarmer.id, status: 'answered' } });
  if (answered)
    await prisma.notification.create({
      data: {
        userId: demoFarmer.id,
        type: 'ticket_reply',
        refId: answered.id,
        title: toJson({ en: 'An officer replied to your question', hi: 'अधिकारी ने आपके प्रश्न का उत्तर दिया' }),
        createdAt: new Date(now.getTime() - 6 * 3600_000),
      },
    });

  // Sanity check that seeded pests resolve through the engine.
  if (!matchPests('chickpea', ['holes'], REFERENCE.pests).length) throw new Error('Pest data did not load');
}

const isMain = process.argv[1]?.replace(/\\/g, '/').endsWith('prisma/seed.ts');
if (isMain) {
  const prisma = new PrismaClient();
  try {
    if (process.argv.includes('--if-empty') && (await prisma.user.count()) > 0) {
      console.log(
        'Database already seeded; skipping. Run `npm run db:reset -w @fieldwise/api` to start fresh.',
      );
    } else {
      const t0 = Date.now();
      // One transaction: one commit instead of thousands, which matters on Windows.
      await prisma.$transaction((tx) => seed(tx), { timeout: 120_000, maxWait: 10_000 });
      const [u, f, tk, pr] = await Promise.all([
        prisma.user.count(),
        prisma.farm.count(),
        prisma.ticket.count(),
        prisma.pestReport.count(),
      ]);
      console.log(
        `Seeded ${u} users, ${f} farms, ${tk} tickets, ${pr} pest reports in ${Date.now() - t0} ms`,
      );
      console.log('Demo logins:', DEMO_ACCOUNTS.map((a) => `${a.role} ${a.phone}`).join(', '));
    }
  } finally {
    await prisma.$disconnect();
  }
}
