# Where the plans come from

The nine plans on the **Plan** tab, the WhatsApp message and the take-home card are written in our own words. The only
author cited is **Ellen G. White** (1827–1915). Nothing is quoted.

| Reference on screen | Book | How it is cited |
| --- | --- | --- |
| `Ministry of Healing ch. 23` | *The Ministry of Healing* (1905) | by chapter (the free e-book's page markers do not line up exactly with the printed pages) |
| `Counsels on Diet §731` | *Counsels on Diet and Foods* (compiled 1938) | by numbered paragraph |
| `Healthful Living §571` | *Healthful Living* (compiled 1897) | by numbered paragraph |
| `Place of Herbs p. 6` | *The Place of Herbs in Rational Therapy* (compiled 1931) | by page (her letter of 1890 on catnip and hop tea) |
| `general advice` | none | widely agreed natural-health advice that her books do not give (amounts, targets, traditional foods and teas, the thought check) |
| `expo safety rule` | none | the expo's own safety rules (foot checks, emergencies, clinic visits, fluid limits, seeing a doctor before hard exercise) |

Her own words are long out of copyright. The compilations and the White Estate's e-book files carry their own rights, so
the app only paraphrases and cites them; it never copies their text. A test checks that most of every plan's steps and
facts cite her, that every cited chapter or paragraph is one that was read for these plans, and that no other author is named.

## The nine plans

| Plan | Chosen when | Main Ellen White references |
| --- | --- | --- |
| Blood pressure | blood pressure 130/85 or more | MH chs. 8, 17, 20, 26; CD §§111, 138, 245, 267, 268, 475, 514, 518, 726, 731; HL §§570, 571, 717 |
| Blood sugar | sugar 6.1 mmol/L or more | MH chs. 17, 26; CD §§146, 168, 191, 245, 267, 268, 504, 518, 726, 731; HL §571 |
| Weight & cholesterol | BMI 25 or more, or cholesterol 5 or more | MH chs. 17, 23, 25; CD §§137, 168, 191, 245, 267, 268, 269, 326, 504, 514, 731; HL §§571, 578 |
| Underweight | BMI under 18.5 | MH ch. 23; CD §§138, 146, 168, 245, 267, 268, 320, 326, 518, 731; HL §§185, 578 |
| Fruit & veg | under 5 servings a day | CD §§111, 137, 146, 245, 267, 464, 475, 509, 514, 518 |
| Exercise | under 30 minutes a day | MH chs. 17, 20; HL §§570, 571, 578, 717, 780 |
| Water | under 8 glasses a day | MH ch. 26; CD §§475, 726, 727, 728, 731; HL §786 |
| Sleep | under 7 hours a night | MH chs. 17, 18, 20, 26; CD §§201, 245, 268, 270; HL §§185, 189, 313, 571, 618, 717; Place of Herbs p. 6 |
| Stress & mood | the visitor asked for stress and peace support | MH chs. 8, 17, 18, 19, 20, 26; CD §§111, 201, 268, 727; HL §§313, 717, 780 |

What the main references say, in short:
- **MH ch. 8:** the true remedies are pure air, sunlight, moderation, rest, exercise, good food, water and trust in God.
- **MH ch. 17:** rest for the overworked; water drunk freely; warm and neutral baths soothe the nerves; inactivity breeds
  disease; walk after meals; useful work lifts the mind.
- **MH ch. 18:** mind and body affect each other; gratitude, speaking of good things, song, sympathy, helping others.
- **MH ch. 19:** time outdoors in nature. **MH ch. 20:** deep breathing, fresh air and sunshine in bedrooms.
- **MH ch. 23 / 25 / 26:** simple plant foods, nuts in place of meat, little fat and sugar, a light third meal, no
  stimulants (tea, coffee, tobacco, alcohol).
- **CD §§267–270, 245:** meals at set times at least five hours apart, nothing between, a hearty breakfast, a light early
  third meal or none, no late suppers.
- **CD §§111, 138, 146, 464, 475, 504, 509, 514, 518:** grains, fruit, nuts and vegetables; staples and dried fruit;
  plenty of fruit and vegetables; whole-grain bread; beans.
- **CD §§168, 191, 137, 326, 320:** eat slowly; much less sugar; food free of grease; enough nourishing food, never a
  meagre diet.
- **CD §§201:** irregular hours for eating and sleeping wear down the mind.
- **CD §§726–731, HL §786:** water drunk freely; hot water before eating; little or no drink with meals.
- **HL §§570, 571, 578, 780:** walking is the best exercise, outdoors every day, brisk but not violent.
- **HL §§185, 189, 313, 618, 717:** sleep restores strength; late hours weaken; air and sun in bedrooms; deep breathing.
- **Place of Herbs p. 6 (Letter 35, 1890):** catnip tea quiets the nerves; hop tea brings sleep.

## How a person is matched to a plan

`planNeeds()` reads the screening numbers and lists what needs attention, most urgent first: red-flag blood pressure,
red-flag sugar, amber blood pressure, amber sugar, weight/cholesterol, underweight, **stress & mood**, sleep, then the
habit checks (fruit & veg, exercise, water). The first item is the plan that opens; the others are one tap away. Each
line explains the reading against the expo's screening ranges; no book is cited there.

**Stress & mood** is offered only when the volunteer ticks *Stress & peace* on the Screen tab (the follow-up card). The
app does not diagnose anyone's mood. A real medical flag (blood pressure, sugar) always comes first.

## Get-help line

The sleep and stress & mood plans show a prominent "Need help now?" box, and include the same words in the WhatsApp message
and on the printed card: the SADAG suicide crisis line (0800 567 567), Lifeline (0861 322 322), and the advice to go to the
nearest clinic or emergency service. **Check these numbers and their hours with SADAG (sadag.org) and Lifeline
(lifelinesa.co.za) before the expo**; published sources disagree on the opening hours. The text is one constant,
`HELP_LINE`, in `index.html`.

## Herb teas

Only four mild teas, all plain water teas (never tinctures, extracts or capsules), and none is a stimulant:
- **Hops and catnip** (sleep plan): Ellen White's letter of 1890 says hop tea brings sleep and catnip tea quiets the
  nerves (Place of Herbs p. 6). Hops is in the sleep plan only.
- **Chamomile and linden flower** (sleep and stress & mood): general advice; her books do not name them.

Each plan shows the hazard notes as expo safety rules: hops adds to sleeping or anxiety pills and alcohol (ask first if
pregnant or breastfeeding); no catnip in pregnancy; chamomile can affect people allergic to ragweed; use fresh linden
flowers, not old stock. Valerian, passionflower, lemon balm and skullcap are left out. Herb prices were not checked, so
the teas are not on the shopping list.

## What was deliberately left out

Some advice in the source books, and in other natural-health books, is unsafe, out of date or contested to hand out at
a health expo, so it is **not** in the plans: fasting, a fruit-only diet, avoiding all milk, eggs or cheese, cold baths
and douches, sweating baths, high-dose supplements, strong herbs, calorie formulas, and any suggestion to reduce
medicine. The app's rule stays: **never stop prescribed pills suddenly; the clinic adjusts them.** Hot baths are never
suggested; the warm, neutral bath (33–35°C) is, with a caution for high blood pressure, heart trouble, diabetes and
numb feet.

## How a plan is shown: do this, why, how

Each plan opens as instructions, not reading material:

1. **Goal and problem** in one line, with the healthy target. For example: *"Bring your blood pressure down.
   Blood pressure 150/95: high (stage 1). Healthy is under 120/80."*
2. **A red-range reading comes first.** Blood pressure 160/100+ or sugar 15+ means *see the triage nurse now*; any
   other red reading means *book a clinic visit this week*. This is the expo's safety rule, not a book claim.
3. **Do these 3 things:** numbered actions, each with **Why** (the reason, with its reference) and **How**
   (concrete steps, plus the food cost where foods are involved).
4. **When these feel easy, add:** the plan's remaining actions.
5. **Check again** (for example, blood pressure in 3 weeks) and **keep taking your pills**.
6. Folded away: the full timed day, home hydrotherapy, and what the plan is based on.

The actions are `ACTIONS` in `index.html`, most important first. Every why and how restates the plan's own steps and
facts, with the same reference; nothing new is claimed. The WhatsApp message and the printed card carry the same
problem line, 3 actions and recheck, so the visitor goes home with what was explained.

## Church plans

A church can write its own plans, for one of the nine problems or one of its own (for example "Joint pain"), and send
them to its visitors:

- **Writing:** church admins use **Church plans** on the Church screen (logo → Church). A plan has a problem, a title,
  up to 8 things to do (each with why and how) and an optional safety note. Admins should write in their own words.
- **Sending:** church staff open a visitor's Plan tab, then **Send a plan from <church>**; plans for the visitor's own
  readings are listed first. The visitor's record keeps the plan's id in `interests.churchPlan`, so it syncs like the
  rest of the record. **Use the app's plan instead** goes back.
- **What the visitor sees:** the church's plan, labelled as written by the church and not reviewed by the app, always
  with the app's safety rules: the red-range warning, "keep taking your pills", and the help line for sleep and stress
  plans. The WhatsApp message and the printed card carry the same plan and credit the church instead of any book.
- **Who can do what:** in the database (`supabase/schema.sql`, table `church_plans`, functions `church_plans`,
  `save_church_plan`, `delete_church_plan`) only the church's approved staff and admins can read its plans, only its
  admins (or the platform admin) can write or delete them, members and other churches see none, and a suspended
  church's staff see none. Run the whole schema file again in the Supabase SQL editor to add them.
- **Practice mode** shows two example plans from a "Practice church" so volunteers can try it.

## The Food screen

On the Plan tab, **Food for this plan** opens one screen with every shopping-list food. It can be filtered by plan (only
plans that have a shopping list) or show all foods. The exercise and water plans have no shopping list, so they show no
food button, and their message and card leave the shopping line out.

- **Why:** `FOOD_WHY` in `index.html`. Every line repeats something a plan already says, with the same reference.
- **Prices:** `FOOD_PRICES` in `index.html`, between the `FOOD_PRICES:BEGIN` / `END` markers. `node tools/update-prices.js`
  rewrites it from `prices/prices.csv` along with the shopping-list prices (including the shared `ITEM_…` entries), so
  never edit it by hand. Valerian still has a price there, but no plan lists it.

## Things to know

- **Prices** are real South African supermarket prices checked on the stores' own websites on 19 Oct 2026 (no book has any). Each item shows the stores and the typical price range; the daily cost is the median price × the daily amount. Prices change and vary by branch, and the app says so wherever it shows them. Two items had no exact match online and use a flagged stand-in: unsifted maize meal (super maize meal shown) and dried figs (dates). The working is in `prices/PRICES.md`; to refresh, update `prices/prices.csv` and run `node tools/update-prices.js`.
- The **blood-pressure and health-age projections** on the Results tab are illustrative counselling estimates, not from
  any book, and are labelled that way.
- Plans are plain data in `index.html` (`PROTOCOLS`). To change a step, edit it there and keep its reference honest:
  only cite a chapter, paragraph or page you have read, and use `G` or `S` when her books do not say it.
- **No doctor or church body has reviewed or approved these plans.** Do not say they are "Adventist approved" or name any
  living doctor as their source unless that person has agreed in writing. **A clinical reviewer should read the plans
  before the expo.**
