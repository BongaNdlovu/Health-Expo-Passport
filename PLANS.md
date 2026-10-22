# Where the plans come from

The five plans on the **Plan** tab, the WhatsApp message and the take-home card are built from two books:

> *Natural Remedies Encyclopedia*, 7th enlarged edition — Vance Ferrell & Harold M. Cherne, M.D. (Harvestime Books)
> *The Lost Art of Thinking* — Neil Nedley, M.D. (Nedley Publishing, 2011)

Every step and every "What the books advise" line shows where it comes from:

- **`p. 527`** — a printed page of the Encyclopedia, so a volunteer can open the same page.
- **`Nedley ch. 16`** — a chapter of *The Lost Art of Thinking*. That book's printed page numbers are not reliable in
  the file we have, so it is cited by chapter, never by an invented page.

The advice is paraphrased, never copied out, and the credit line names only the books a plan actually uses.

| Plan | Encyclopedia (printed pages) | Nedley (chapters) |
| --- | --- | --- |
| Blood pressure | Hypertension 526–528 · bands 532 · neutral bath 259 · overweight 480 | 13 exercise · 15 breathing · 17 water |
| Blood sugar | Diabetes 656–658 · hydrotherapy cautions 256–259 | 11 food · 13 exercise · 17 water |
| Weight & cholesterol | Overweight 480–482 · High cholesterol & triglycerides 531–532 | 11 (his five-part weight-loss programme, cholesterol) · 13 · 17 |
| Sleep | Insomnia 547–548 · neutral bath 259 | 16 "Rewind in Your Sleep" · 14 light · 15 breathing |
| Stress & mood | Neutral bath 259 | 1–10 ten thinking habits · 11, 13–19 lifestyle |

## How a person is matched to a plan

`planNeeds()` reads the screening numbers and lists what needs attention, in this order: red-flag blood pressure,
red-flag sugar, amber blood pressure, amber sugar, weight/cholesterol, **stress & mood**, sleep. The first item is the
plan that opens; the others are one tap away. Each line explains the reading in the books' own terms.

**Stress & mood** is offered only when the volunteer ticks *Stress & peace* on the Screen tab (the follow-up card). The app
does not diagnose anyone's mood. A real medical flag (blood pressure, sugar) always comes first.

## Get-help line

The sleep and stress & mood plans show a prominent "Need help now?" box, and include the same words in the WhatsApp message
and on the printed card: the SADAG suicide crisis line (0800 567 567), Lifeline (0861 322 322), and the advice to go to the
nearest clinic or emergency service. **Check these numbers and their hours with SADAG (sadag.org) and Lifeline
(lifelinesa.co.za) before the expo**; published sources disagree on the opening hours. The text is one constant,
`HELP_LINE`, in `index.html`.

## What was deliberately left out

Both books contain advice that is unsafe or contested to hand out at a health expo, so these are **not** in the plans:
high-dose vitamin, mineral and omega-3 supplements, fasting days, strong herbal formulas, cayenne in teaspoon doses, hot
baths for people with diabetes or high blood pressure, "aggressive" exercise targets for everyone, and any suggestion to
reduce medicine. The app's rule stays: **never stop prescribed pills suddenly; the clinic adjusts them.** The books'
own cautions are kept: no extreme hot/cold treatments in diabetes (Encyclopedia p. 256), no hot foot bath with hardened
arteries or numb feet (p. 257), no hot tub bath with high blood pressure or diabetes (p. 259), and see a doctor before
vigorous exercise with heart disease or several heart risk factors (Nedley ch. 13).

Where the two books disagree the plans take the cautious route. Example: the Encyclopedia says to avoid tomatoes and
potatoes at night; Nedley lists tomatoes among melatonin-rich foods. The sleep plan mentions neither.

## How a plan is shown: do this, why, how

Each plan opens as instructions, not reading material:

1. **Goal and problem** in one line, with the healthy target. For example: *"Bring your blood pressure down.
   Blood pressure 150/95: high (stage 1). Healthy is under 120/80."*
2. **A red-range reading comes first.** Blood pressure 160/100+ or sugar 15+ means *see the triage nurse now*; any
   other red reading means *book a clinic visit this week*. This is the expo's safety rule, not a book claim.
3. **Do these 3 things:** numbered actions, each with **Why** (the book's reason, with its reference) and **How**
   (concrete steps, plus the food cost where foods are involved).
4. **When these feel easy, add:** the plan's remaining actions.
5. **Check again** (for example, blood pressure in 3 weeks) and **keep taking your pills**.
6. Folded away: the full timed day, home hydrotherapy, and everything the books say.

The actions are `ACTIONS` in `index.html`, most important first. Every why and how restates the plan's own steps and
facts, with the same reference; nothing new is claimed. They adapt to the person: an action can apply only to
some visitors (for example "lose extra weight slowly" only when the BMI is 25 or more), or move to the top for them (for example
"cut out fried food and animal fat" when cholesterol, not weight, is the problem). The WhatsApp message and the
printed card carry the same problem line, 3 actions and recheck, so the visitor goes home with what was explained.

The printed A6 card measures itself before printing and steps the text down a size if anything would be cut off.
(The previous card ran past the bottom edge and lost the safety note.)

## The Food screen

On the Plan tab, **See the food** opens one screen with every shopping-list food (16 in all). It can be filtered by plan
or show all foods. Bars show the cost **per day**, over the **21 days**, or the **store prices** (cheapest store, median, dearest
store). Tapping a food shows **why it is in the plan** and how its price was worked out.

- **Why:** `FOOD_WHY` in `index.html`, from three books:
  - Lines tagged with a plan repeat something that plan already says, with the same page or chapter reference. To add
    one, put it in the plan's steps or facts first, then repeat it there.
  - Lines tagged **Encyclopedia of Foods** paraphrase *Encyclopedia of Foods and Their Healing Power*, Vol. 1
    (George D. Pamplona-Roger, M.D., Education and Health Library). They are cited as "vol. 1, p." with the printed page.
    Only Volume 1 was available; its detailed food chapters are in Volume 2. The book's cancer claims are deliberately
    left out.
- **Green beans:** that book says raw green beans contain a natural toxin that cooking destroys (vol. 1, p. 109). The
  blood-sugar plan's snack line therefore now says "cooked green beans (never raw)", and the Food screen shows the caution.
- **Prices:** `FOOD_PRICES` in `index.html`, between the `FOOD_PRICES:BEGIN` / `END` markers. `node tools/update-prices.js`
  rewrites it from `prices/prices.csv` along with the shopping-list prices, so never edit it by hand.

## Things to know

- **Prices** are real South African supermarket prices checked on the stores' own websites on 19 Oct 2026 (neither book has any): Pick n Pay, Checkers, Shoprite, Woolworths, Makro, Game, one SPAR store's webshop and Dis-Chem. Each item shows the stores and the typical price range; the daily cost is the median price × the daily amount. Prices change and vary by branch, and the app says so wherever it shows them. Three items had no exact match online and use a flagged stand-in: unsifted maize meal (super maize meal shown), valerian teabags (loose dried valerian root) and dried figs (dates). The working is in `prices/PRICES.md`; to refresh, update `prices/prices.csv` and run `node tools/update-prices.js`.
- The **blood-pressure and health-age projections** on the Results tab are illustrative counselling estimates from the
  original app, not from either book, and are labelled that way.
- The **calorie rule of thumb** on the weight plan is the Encyclopedia's (p. 481).
- Plans are plain data in `index.html` (`PROTOCOLS`). To change a step, edit it there and keep its reference honest.
- Some of the books' advice is contested (for example the Encyclopedia's diabetes chapter advises avoiding gluten grains and
  cow's milk). The plans use the guidance only where it is mainstream-safe and cite where it comes from so a clinician can
  review it. **A clinical reviewer should read the plans before the expo.**
