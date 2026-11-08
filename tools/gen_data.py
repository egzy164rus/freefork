# Генератор встроенной базы продуктов и рецептов (значения на 100 г / 100 мл).
# Запуск: python3 tools/gen_data.py  -> src/FreeFork/Data/foods.json, recipes.json
import json, os
OUT = os.path.join(os.path.dirname(__file__), "..", "src", "FreeFork", "Data")

# id|ru|en|kcal|p|f|c|fiber|piece_g|piece_ru|piece_en|portion_g|family|aliases
F = """
grechka_cooked|Гречка варёная|Buckwheat, cooked|110|4.2|1.1|21.3|2.7|||||grechka|гречка,гречневая каша,buckwheat
grechka_dry|Гречка сухая|Buckwheat, dry|313|12.6|3.3|62.1|11.3|||||grechka|крупа гречневая
rice_cooked|Рис варёный|Rice, cooked|130|2.7|0.3|28|0.4|||||rice|рис,белый рис,rice
rice_dry|Рис сухой|Rice, dry|344|6.7|0.7|78.9|1.3|||||rice|крупа рисовая
oatmeal|Овсяная каша на воде|Oatmeal porridge|71|2.5|1.5|12|1.7|||250|oat|овсянка,овсяная каша,porridge,oatmeal
oats_dry|Овсяные хлопья|Rolled oats|366|12.3|6.1|59.5|8.2|||||oat|геркулес,хлопья,овсянка сухая,oats
pasta_cooked|Макароны варёные|Pasta, cooked|131|5|1.1|25|1.8|||200|pasta|макароны,паста,спагетти,лапша,pasta,spaghetti,noodles
pasta_dry|Макароны сухие|Pasta, dry|352|12|1.5|71.5|3|||80|pasta|паста сухая
potato_boiled|Картофель варёный|Potato, boiled|82|2|0.4|16.7|1.8|120|шт|pc|200|potato|картофель,картошка,potato
potato_fried|Картофель жареный|Potato, fried|192|2.8|9.5|23.4|2|||200|potato|жареная картошка
potato_mashed|Картофельное пюре|Mashed potatoes|106|2|3.3|16|1.5|||200|potato|пюре,картошка пюре,mashed potato
fries|Картофель фри|French fries|312|3.4|15|41|3.8|||120||фри,fries
bread_white|Хлеб белый|White bread|266|8.1|3.2|48.8|2.7|30|ломтик|slice||bread|хлеб,батон,bread
bread_rye|Хлеб ржаной|Rye bread|214|6.6|1.2|40.9|5.8|30|ломтик|slice||bread|чёрный хлеб,бородинский,rye
bread_whole|Хлеб цельнозерновой|Whole grain bread|247|13|3.4|41|7|30|ломтик|slice||bread|цельнозерновой хлеб,whole wheat bread
toast|Тост|Toast|265|8|3.5|49|2.5|25|шт|pc||bread|тосты,тост,toast
lavash|Лаваш|Lavash flatbread|275|9.1|1.2|56.5|2.5|80|лист|sheet||bread|лаваш,тортилья,tortilla,wrap
bun|Булочка сдобная|Sweet bun|297|7.6|7.5|49|2|70|шт|pc||bun|булка,булочка,bun
croissant|Круассан|Croissant|406|8.2|21|46|2.4|60|шт|pc||bun|круассан,croissant
chicken_breast|Куриная грудка|Chicken breast|150|30|3|0|0|||150|chicken|курица,куриное филе,филе курицы,грудка,chicken,куриная грудка
chicken_thigh|Куриное бедро|Chicken thigh|190|22|11|0|0|||150|chicken|окорочок,куриная ножка,куриные бедра,бедро,chicken leg
beef|Говядина варёная|Beef, cooked|232|26|14|0|0|||150|meat|говядина,мясо,beef,meat
beef_mince|Фарш говяжий|Ground beef|254|17|20|0|0|||150|mince|фарш,мясной фарш,ground beef,mince
pork|Свинина|Pork|259|16|21|0|0|||150|meat|свинина,pork
turkey|Индейка|Turkey|140|25|4|0|0|||150|poultry|индейка,индюшка,turkey
sausage|Колбаса варёная|Boiled sausage|257|12|23|1.5|0|20|ломтик|slice||sausage|колбаса,докторская,sausage
sausages|Сосиски|Frankfurters|266|11|24|1.6|0|50|шт|pc||sausage|сосиска,сардельки,hot dog,sausages
ham|Ветчина|Ham|145|18|8|1|0|25|ломтик|slice||ham|ветчина,ham
bacon|Бекон|Bacon|541|37|42|1.4|0|15|ломтик|slice||bacon|бекон,bacon
salmon|Лосось|Salmon|208|20|13|0|0|||150|fish|лосось,сёмга,семга,форель,красная рыба,salmon,trout
tuna_can|Тунец консервированный|Canned tuna|116|26|1|0|0|||100|tuna|тунец,тунца,тунцом,tuna
cod|Треска|Cod|82|18|0.7|0|0|||150|whitefish|треска,минтай,белая рыба,хек,рыба,cod,fish
shrimp|Креветки|Shrimp|99|24|0.3|0.2|0|||100|shrimp|креветки,shrimp,prawns
herring|Сельдь солёная|Salted herring|217|17|16|0|0|||80||сельдь,селёдка,herring
egg|Яйцо куриное|Egg|157|12.7|11.5|0.7|0|55|шт|pc||egg|яйцо,яйца,яиц,яичница,варёное яйцо,egg,eggs
egg_white|Яичный белок|Egg white|52|11|0.2|0.7|0|33|шт|pc||eggwhite|белок яичный,белки,egg white
milk|Молоко 2.5%|Milk 2.5%|52|2.8|2.5|4.7|0|||200|milk|молоко,milk
kefir|Кефир 1%|Kefir 1%|40|3|1|4|0|||200||кефир,kefir
yogurt|Йогурт натуральный|Plain yogurt|66|5|3.2|3.5|0|||125|yogurt|йогурт,yogurt
yogurt_greek|Греческий йогурт|Greek yogurt|97|9|5|4|0|||150|yogurt|греческий йогурт,greek yogurt
cottage_5|Творог 5%|Cottage cheese 5%|121|17|5|1.8|0|||150|cottage|творог,cottage cheese
cottage_0|Творог обезжиренный|Cottage cheese, fat-free|71|16|0.6|1.3|0|||150|cottage|творог 0,обезжиренный творог
sour_cream|Сметана 20%|Sour cream 20%|206|2.8|20|3.2|0|||30||сметана,sour cream
cheese|Сыр твёрдый|Hard cheese|356|24|28|0.5|0|20|ломтик|slice|30|cheese|сыр,гауда,чеддер,российский,cheese
mozzarella|Моцарелла|Mozzarella|280|22|22|2.2|0|||50|cheese|моцарелла,mozzarella
feta|Брынза (фета)|Feta|264|14|21|4|0|||50|cheese|брынза,фета,feta
cream_cheese|Творожный сыр|Cream cheese|342|6|34|4|0|||30||сливочный сыр,филадельфия,cream cheese
butter|Сливочное масло|Butter|717|0.5|81.1|0.8|0|||10||масло,масло сливочное,butter
cream|Сливки 10%|Cream 10%|118|3|10|4|0|||50||сливки,cream
tomato|Помидор|Tomato|20|1.1|0.2|3.7|1.2|100|шт|pc||tomato|помидоры,томат,томаты,tomato,tomatoes
cucumber|Огурец|Cucumber|15|0.8|0.1|2.8|1|100|шт|pc||cucumber|огурцы,cucumber
bell_pepper|Болгарский перец|Bell pepper|27|1.3|0|5.3|1.8|120|шт|pc||pepper|перец,перца,pepper,paprika
carrot|Морковь|Carrot|35|1.3|0.1|6.9|2.4|80|шт|pc||carrot|морковка,carrot
onion|Лук репчатый|Onion|41|1.4|0|8.2|1.7|80|шт|pc||onion|лук,onion
cabbage|Капуста белокочанная|Cabbage|28|1.8|0.1|4.7|2|||100|cabbage|капуста,cabbage
broccoli|Брокколи|Broccoli|34|2.8|0.4|6.6|2.6|||100||брокколи,broccoli
cauliflower|Цветная капуста|Cauliflower|30|2.5|0.3|5|2|||100||цветная капуста,cauliflower
zucchini|Кабачок|Zucchini|24|0.6|0.3|4.6|1|||150|zucchini|кабачки,цуккини,zucchini,courgette
eggplant|Баклажан|Eggplant|24|1.2|0.1|4.5|3|200|шт|pc||eggplant|баклажаны,eggplant,aubergine
beet|Свёкла|Beetroot|43|1.6|0.2|9.6|2.8|100|шт|pc||beet|свекла,свёкла,beet,beetroot
spinach|Шпинат|Spinach|23|2.9|0.4|3.6|2.2|||50||шпинат,spinach
lettuce|Салатные листья|Lettuce|15|1.4|0.2|2.9|1.3|||50||салат,салат листовой,латук,lettuce,salad leaves
mushrooms|Шампиньоны|Mushrooms|27|4.3|1|0.1|1|||100||грибы,шампиньоны,mushrooms
garlic|Чеснок|Garlic|143|6.5|0.5|29.9|2.1|4|зубчик|clove|5||чеснок,garlic
corn_can|Кукуруза консервированная|Canned corn|58|2.2|0.4|11|2|||80||кукуруза,corn
peas|Зелёный горошек|Green peas|72|5|0.2|13|5|||80||горошек,горох,peas
beans_can|Фасоль консервированная|Canned beans|90|6|0.5|15|5|||100||фасоль,beans
chickpeas|Нут варёный|Chickpeas, cooked|164|8.9|2.6|27|7.6|||100||нут,chickpeas
lentils|Чечевица варёная|Lentils, cooked|116|9|0.4|20|7.9|||150||чечевица,lentils
pumpkin|Тыква|Pumpkin|28|1.3|0.3|7.7|2|||150||тыква,pumpkin
avocado|Авокадо|Avocado|160|2|14.7|8.5|6.7|150|шт|pc||avocado|авокадо,avocado
olives|Оливки|Olives|115|0.8|10.7|6.3|3|4|шт|pc|30||оливки,маслины,olives
apple|Яблоко|Apple|52|0.3|0.2|13.8|2.4|180|шт|pc||apple|яблоки,apple
banana|Банан|Banana|89|1.1|0.3|22.8|2.6|120|шт|pc||banana|бананы,banana
orange|Апельсин|Orange|47|0.9|0.1|11.8|2.4|150|шт|pc||orange|апельсины,orange
mandarin|Мандарин|Mandarin|53|0.8|0.3|13|1.8|80|шт|pc||orange|мандарины,mandarin,tangerine
pear|Груша|Pear|57|0.4|0.1|15|3.1|170|шт|pc||pear|груши,pear
grapes|Виноград|Grapes|69|0.7|0.2|18|0.9|||100||виноград,grapes
strawberry|Клубника|Strawberry|32|0.7|0.3|7.7|2|||100|berries|клубника,земляника,strawberry,strawberries
blueberry|Черника|Blueberries|57|0.7|0.3|14.5|2.4|||80|berries|черника,голубика,ягоды,blueberry,berries
watermelon|Арбуз|Watermelon|30|0.6|0.2|7.6|0.4|||200||арбуз,watermelon
kiwi|Киви|Kiwi|61|1.1|0.5|14.7|3|75|шт|pc||kiwi|киви,kiwi
peach|Персик|Peach|39|0.9|0.3|9.5|1.5|150|шт|pc||peach|персики,peach
lemon|Лимон|Lemon|29|1.1|0.3|9|2.8|60|шт|pc|20||лимон,lemon
dried_apricots|Курага|Dried apricots|241|3.4|0.5|63|7.3|8|шт|pc|30||курага,dried apricots
raisins|Изюм|Raisins|299|3.1|0.5|79|3.7|||30||изюм,raisins
dates|Финики|Dates|282|2.5|0.4|75|8|8|шт|pc||dates|финики,dates
prunes|Чернослив|Prunes|240|2.2|0.4|64|7|10|шт|pc||prunes|чернослив,prunes
almonds|Миндаль|Almonds|579|21|50|22|12.5|||30|nuts|миндаль,almonds
walnuts|Грецкие орехи|Walnuts|654|15|65|14|6.7|||30|nuts|орехи,грецкий орех,walnuts,nuts
peanuts|Арахис|Peanuts|567|26|49|16|8.5|||30|nuts|арахис,peanuts
cashew|Кешью|Cashews|553|18|44|30|3.3|||30|nuts|кешью,cashew
peanut_butter|Арахисовая паста|Peanut butter|588|25|50|20|6|||20||арахисовая паста,peanut butter
sunflower_seeds|Семечки подсолнечные|Sunflower seeds|584|21|51|20|8.6|||30||семечки,sunflower seeds
chia|Семена чиа|Chia seeds|486|17|31|42|34|||15||чиа,chia
sunflower_oil|Подсолнечное масло|Sunflower oil|899|0|99.9|0|0|||10|oil|масло подсолнечное,растительное масло,масло растительное,oil,sunflower oil
olive_oil|Оливковое масло|Olive oil|884|0|100|0|0|||10|oil|масло оливковое,olive oil
sugar|Сахар|Sugar|399|0|0|99.8|0|||10||сахар,sugar
honey|Мёд|Honey|304|0.3|0|82.4|0.2|||20||мед,мёд,honey
chocolate_dark|Тёмный шоколад|Dark chocolate|546|5|31|61|7|||25|chocolate|шоколад,горький шоколад,dark chocolate,chocolate
chocolate_milk|Молочный шоколад|Milk chocolate|535|7.7|30|59|2|||25|chocolate|молочный шоколад,milk chocolate
cookies|Печенье|Cookies|417|7|15|67|2|12|шт|pc|36||печенье,cookies,biscuits
ice_cream|Мороженое пломбир|Ice cream|207|3.5|11|24|0|||80||мороженое,пломбир,ice cream
cake|Торт|Cake|350|4.5|17|46|1|||100||торт,пирожное,cake
jam|Варенье|Jam|263|0.3|0|68|0.5|||20||варенье,джем,jam
muesli|Мюсли|Muesli|360|9|6|66|7|||50||мюсли,muesli
cornflakes|Кукурузные хлопья|Corn flakes|357|7.5|0.4|84|3|||40||хлопья кукурузные,cornflakes,corn flakes
protein_bar|Протеиновый батончик|Protein bar|380|30|12|35|5|60|шт|pc||protein_bar|батончик,протеиновый батончик,protein bar,bar
protein_powder|Протеин (порошок)|Protein powder|380|78|6|8|0|30|мерная ложка|scoop||protein|протеин,сывороточный протеин,protein,whey
flour|Мука пшеничная|Wheat flour|334|10.3|1|68|3|||30||мука,flour
cola|Кола|Cola|42|0|0|10.6|0|||330||кола,coca cola,пепси,cola
juice_orange|Апельсиновый сок|Orange juice|45|0.7|0.2|10.4|0.2|||250||сок,апельсиновый сок,juice,orange juice
coffee|Кофе чёрный|Black coffee|2|0.1|0|0|0|||200||кофе,американо,эспрессо,coffee,americano,espresso
cappuccino|Капучино|Cappuccino|40|2|2|3.5|0|||250||капучино,cappuccino
latte|Латте|Latte|45|2.5|2|4|0|||300||латте,latte
water|Вода|Water|0|0|0|0|0|||250|water|вода,воды,минералка,water
tea|Чай без сахара|Tea, unsweetened|1|0|0|0.2|0|||250||чай,tea
beer|Пиво|Beer|43|0.5|0|3.6|0|||500||пиво,beer
wine|Вино красное|Red wine|85|0.1|0|2.6|0|||150||вино,wine,red wine
vodka|Водка|Vodka|235|0|0|0.1|0|||50||водка,vodka
energy_drink|Энергетик|Energy drink|45|0|0|11|0|||250||энергетик,energy drink
borscht|Борщ|Borscht|49|1.1|2.5|5.4|1|||300||борщ,borscht
chicken_soup|Куриный суп|Chicken soup|36|3|1.5|3|0.5|||300||суп,куриный суп,суп куриный,soup,chicken soup
pelmeni|Пельмени|Dumplings (pelmeni)|275|11.9|12.4|29|1.5|15|шт|pc||pelmeni|пельмени,вареники,pelmeni,dumplings
syrniki|Сырники|Syrniki (cheese pancakes)|220|16|11|14|0.5|50|шт|pc||syrniki|сырники,syrniki
pancakes|Блины|Pancakes (blini)|233|6.1|12.3|26|1|50|шт|pc||pancakes|блины,блинчики,оладьи,pancakes,crepes
omelet|Омлет|Omelette|154|9.6|12|2|0|||150||омлет,omelet,omelette
pizza|Пицца|Pizza|266|11|10|33|2|110|кусок|slice||pizza|пицца,pizza
burger|Бургер|Burger|295|17|14|24|1.5|200|шт|pc||burger|гамбургер,чизбургер,бургер,burger,cheeseburger
shawarma|Шаурма|Shawarma|215|12|10|20|1.5|300|шт|pc||shawarma|шаурма,шаверма,донер,shawarma,doner
sushi|Суши/роллы|Sushi rolls|150|5|1|30|0.5|30|шт|pc|180||суши,роллы,ролл,sushi,rolls
olivier|Салат Оливье|Olivier salad|198|3.8|16|8.5|1|||150||оливье,olivier
caesar|Салат Цезарь с курицей|Chicken Caesar salad|180|10|12|8|1|||200||цезарь,салат цезарь,caesar
greek_salad|Греческий салат|Greek salad|110|3|9|4|1.5|||200||греческий салат,greek salad
plov|Плов|Plov (pilaf)|190|6|9|22|1|||250||плов,pilaf,plov
cutlet|Котлета мясная|Meat cutlet|230|14|15|10|0.5|80|шт|pc||cutlet|котлета,котлеты,cutlet
hummus|Хумус|Hummus|166|8|10|14|6|||50||хумус,hummus
tofu|Тофу|Tofu|76|8|4.8|1.9|0.3|||100||тофу,tofu
ketchup|Кетчуп|Ketchup|93|1.8|0.1|22|0.3|||15|sauce|кетчуп,ketchup
mayonnaise|Майонез|Mayonnaise|627|2.4|67|3.9|0|||15|sauce|майонез,mayonnaise
soy_sauce|Соевый соус|Soy sauce|53|8|0|5|0.8|||15|sauce|соевый соус,soy sauce
pickles|Солёные огурцы|Pickles|11|0.8|0.1|1.7|1|50|шт|pc||pickles|соленые огурцы,соленые огурчики,маринованные огурцы,pickles
"""
foods = []
ids = set()
for line in F.strip().splitlines():
    p = line.split("|")
    if len(p) == 13 and p[8] == "" and p[9] == "":
        p.insert(10, "")  # строка вида ...|||200|family|... -> пустые piece*, portion=200
    assert len(p) == 14, (len(p), line)
    (id_, ru, en, kcal, pr, fa, ca, fi, pg, pru, pen, por, fam, al) = p
    assert id_ not in ids, id_
    ids.add(id_)
    piece = float(pg) if pg else None
    portion = float(por) if por else (piece if piece else 100.0)
    foods.append({
        "id": id_, "ru": ru, "en": en,
        "kcal": float(kcal), "p": float(pr), "f": float(fa), "c": float(ca), "fiber": float(fi),
        "pieceG": piece, "pieceRu": pru or None, "pieceEn": pen or None,
        "portionG": portion, "family": fam or id_,
        "aliases": [a.strip() for a in al.split(",") if a.strip()],
    })

# ---- Рецепты: id | ru | en | meals | minutes | ingredients(food:g;...) | steps_ru | steps_en
R = """
oats_banana|Овсянка с бананом и орехами|Banana-walnut oatmeal|breakfast|10|oats_dry:50;milk:150;banana:110;walnuts:10|Залейте хлопья горячим молоком и варите 5 минут.;Добавьте нарезанный банан и орехи.|Cook the oats in hot milk for 5 minutes.;Top with sliced banana and walnuts.
omelet_cheese|Омлет с сыром и помидором|Cheese & tomato omelette|breakfast,dinner|10|egg:165;milk:50;cheese:20;tomato:80;butter:5|Взбейте яйца с молоком.;Обжарьте на масле с помидором 3 минуты.;Посыпьте сыром и накройте крышкой на минуту.|Whisk eggs with milk.;Fry in butter with tomato for 3 minutes.;Add cheese, cover for a minute.
egg_toast_avocado|Тост с яйцом и авокадо|Avocado egg toast|breakfast,snack|10|egg:110;toast:50;avocado:60|Поджарьте тосты.;Разомните авокадо и намажьте на тост.;Сверху выложите яйца (варёные или пашот).|Toast the bread.;Mash avocado and spread on toast.;Top with boiled or poached eggs.
syrniki_plain|Сырники|Syrniki (cottage cheese pancakes)|breakfast|20|cottage_5:200;egg:55;flour:30;sugar:10;sunflower_oil:8|Смешайте творог, яйцо, муку и сахар.;Сформируйте сырники и обжарьте с двух сторон до золотистой корочки.|Mix cottage cheese, egg, flour and sugar.;Shape patties and fry until golden on both sides.
greek_yogurt_berries|Греческий йогурт с ягодами|Greek yogurt with berries|breakfast,snack|3|yogurt_greek:200;blueberry:80;honey:10;almonds:10|Выложите йогурт в миску.;Добавьте ягоды, мёд и орехи.|Spoon yogurt into a bowl.;Top with berries, honey and nuts.
buckwheat_chicken|Гречка с курицей и овощами|Buckwheat with chicken & veggies|lunch,dinner|30|grechka_dry:70;chicken_breast:130;onion:50;carrot:50;sunflower_oil:8|Отварите гречку.;Обжарьте лук и морковь, добавьте нарезанную курицу и тушите 10 минут.;Смешайте с гречкой.|Boil the buckwheat.;Sauté onion and carrot, add diced chicken and simmer 10 minutes.;Combine with buckwheat.
chicken_rice_broccoli|Курица с рисом и брокколи|Chicken, rice & broccoli|lunch,dinner|25|rice_dry:70;chicken_breast:150;broccoli:150;soy_sauce:15;sunflower_oil:5|Отварите рис.;Обжарьте курицу кусочками, добавьте брокколи и соевый соус.;Подавайте с рисом.|Cook the rice.;Stir-fry chicken pieces, add broccoli and soy sauce.;Serve over rice.
pasta_tuna|Паста с тунцом и томатами|Tuna tomato pasta|lunch,dinner|20|pasta_dry:80;tuna_can:80;tomato:150;olive_oil:8;garlic:5|Отварите пасту.;На масле прогрейте чеснок и томаты, добавьте тунец.;Смешайте с пастой.|Cook the pasta.;Warm garlic and tomatoes in oil, add tuna.;Toss with pasta.
pasta_bolognese|Паста болоньезе|Pasta bolognese|lunch,dinner|35|pasta_dry:80;beef_mince:120;tomato:150;onion:50;olive_oil:8|Обжарьте лук и фарш.;Добавьте томаты и тушите 15 минут.;Подавайте с отварной пастой.|Brown the onion and mince.;Add tomatoes and simmer 15 minutes.;Serve with cooked pasta.
greek_salad_recipe|Греческий салат|Greek salad|lunch,dinner,snack|10|tomato:150;cucumber:100;bell_pepper:50;feta:60;olives:30;olive_oil:10;onion:20|Нарежьте овощи крупными кусками.;Добавьте фету и оливки, заправьте маслом.|Chop vegetables into chunks.;Add feta and olives, dress with oil.
tuna_egg_salad|Салат с тунцом и яйцом|Tuna & egg salad|lunch,dinner|15|lettuce:80;tuna_can:80;egg:55;cucumber:80;tomato:80;olive_oil:8|Отварите яйцо.;Нарежьте овощи, добавьте тунец и яйцо.;Заправьте маслом.|Boil the egg.;Chop the vegetables, add tuna and egg.;Dress with oil.
salmon_potato|Лосось с картофелем и брокколи|Baked salmon with potatoes|dinner|30|salmon:150;potato_boiled:200;broccoli:100;olive_oil:5;lemon:20|Запеките лосось с лимоном 15 минут при 200 °C.;Отварите картофель и брокколи.;Подавайте вместе.|Bake salmon with lemon 15 minutes at 200 °C.;Boil potatoes and broccoli.;Serve together.
chicken_veg_stew|Овощное рагу с курицей|Chicken & vegetable stew|lunch,dinner|40|chicken_thigh:130;zucchini:150;eggplant:100;tomato:100;onion:50;bell_pepper:80;sunflower_oil:8|Обжарьте курицу.;Добавьте нарезанные овощи и тушите под крышкой 25 минут.|Brown the chicken.;Add chopped vegetables and simmer covered for 25 minutes.
lentil_soup|Чечевичный суп|Lentil soup|lunch,dinner|30|lentils:200;carrot:60;onion:50;tomato:100;sunflower_oil:8|Обжарьте лук и морковь.;Добавьте чечевицу, томаты и воду, варите 15 минут.|Sauté onion and carrot.;Add lentils, tomatoes and water, cook 15 minutes.
hummus_toast|Тосты с хумусом и овощами|Hummus veggie toast|breakfast,snack,lunch|5|bread_whole:60;hummus:60;cucumber:60;tomato:50|Намажьте хумус на хлеб.;Выложите овощи.|Spread hummus on bread.;Top with vegetables.
tofu_bowl|Боул с тофу и рисом|Tofu rice bowl|lunch,dinner|25|tofu:150;rice_dry:60;carrot:60;cabbage:80;soy_sauce:15;sunflower_oil:5|Отварите рис.;Обжарьте тофу с овощами и соевым соусом.;Выложите на рис.|Cook the rice.;Stir-fry tofu and vegetables with soy sauce.;Serve over rice.
ham_cheese_sandwich|Бутерброд с ветчиной и сыром|Ham & cheese sandwich|breakfast,snack|5|bread_white:60;ham:40;cheese:25;tomato:50;butter:5|Намажьте хлеб маслом.;Добавьте ветчину, сыр и помидор.|Butter the bread.;Add ham, cheese and tomato.
cottage_fruit|Творог с фруктами и мёдом|Cottage cheese with fruit|breakfast,snack|5|cottage_0:200;apple:100;banana:60;honey:10|Нарежьте фрукты.;Смешайте с творогом и полейте мёдом.|Slice the fruit.;Mix with cottage cheese and drizzle honey.
potato_mince_bake|Картофельная запеканка с фаршем|Potato & mince bake|dinner|50|potato_boiled:250;beef_mince:100;onion:40;cheese:20;sour_cream:20|Выложите слоями картофель и обжаренный фарш с луком.;Посыпьте сыром и запекайте 25 минут.|Layer potatoes with fried mince and onion.;Top with cheese and bake 25 minutes.
lavash_chicken_wrap|Ролл в лаваше с курицей|Chicken wrap|lunch,snack|10|lavash:80;chicken_breast:100;cucumber:60;tomato:60;yogurt:30|Нарежьте курицу и овощи.;Заверните в лаваш с йогуртовым соусом.|Slice the chicken and vegetables.;Wrap in lavash with yogurt sauce.
protein_smoothie|Протеиновый смузи|Protein smoothie|breakfast,snack|5|milk:250;banana:120;protein_powder:30;peanut_butter:15|Взбейте всё блендером.|Blend everything until smooth.
fried_rice_egg|Жареный рис с яйцом|Egg fried rice|lunch,dinner|20|rice_dry:70;egg:110;carrot:50;peas:50;soy_sauce:15;sunflower_oil:8|Отварите рис и остудите.;Обжарьте овощи, добавьте яйца и рис, заправьте соевым соусом.|Cook and cool the rice.;Fry the vegetables, add eggs and rice, season with soy sauce.
tomato_cucumber_salad|Салат из овощей со сметаной|Veggie salad with sour cream|lunch,dinner,snack|5|tomato:150;cucumber:150;sour_cream:30;onion:20|Нарежьте овощи.;Заправьте сметаной.|Chop the vegetables.;Dress with sour cream.
zucchini_fritters|Кабачковые оладьи|Zucchini fritters|breakfast,lunch,dinner|25|zucchini:250;egg:55;flour:40;sour_cream:30;sunflower_oil:8|Натрите кабачок, отожмите.;Смешайте с яйцом и мукой, обжарьте оладьи.;Подавайте со сметаной.|Grate and squeeze the zucchini.;Mix with egg and flour, fry fritters.;Serve with sour cream.
tuna_avocado_bowl|Боул с тунцом и авокадо|Tuna avocado bowl|lunch,dinner|20|rice_dry:60;tuna_can:80;avocado:60;cucumber:80;soy_sauce:10|Отварите рис.;Сверху выложите тунец, авокадо и огурец.|Cook the rice.;Top with tuna, avocado and cucumber.
buckwheat_milk|Гречневая каша с молоком|Buckwheat milk porridge|breakfast|25|grechka_dry:60;milk:200;butter:5;honey:10|Отварите гречку в молоке до готовности.;Добавьте масло и мёд.|Cook buckwheat in milk until tender.;Add butter and honey.
shakshuka|Шакшука|Shakshuka|breakfast,lunch,dinner|25|egg:110;tomato:200;bell_pepper:80;onion:50;olive_oil:8;feta:30|Обжарьте лук и перец, добавьте томаты.;Сделайте лунки, вбейте яйца, накройте крышкой на 6 минут.;Посыпьте фетой.|Sauté onion and pepper, add tomatoes.;Make wells, crack in eggs, cover for 6 minutes.;Sprinkle with feta.
fruit_yogurt_salad|Фруктовый салат с йогуртом|Fruit salad with yogurt|breakfast,snack|5|apple:100;banana:60;orange:100;kiwi:75;yogurt:100;honey:10|Нарежьте фрукты кубиками.;Заправьте йогуртом и мёдом.|Dice the fruit.;Dress with yogurt and honey.
turkey_veg_plate|Индейка с овощами и картофелем|Turkey with veggies & potatoes|dinner|30|turkey:150;potato_boiled:150;cauliflower:100;carrot:50;olive_oil:6|Запеките индейку и овощи 25 минут.;Подавайте с отварным картофелем.|Bake turkey and vegetables for 25 minutes.;Serve with boiled potatoes.
mushroom_omelet|Омлет с грибами и шпинатом|Mushroom spinach omelette|breakfast,dinner|12|egg:165;mushrooms:100;spinach:40;butter:5|Обжарьте грибы со шпинатом.;Залейте взбитыми яйцами и готовьте под крышкой 4 минуты.|Fry mushrooms and spinach.;Pour in beaten eggs and cook covered for 4 minutes.
"""
recipes = []
for line in R.strip().splitlines():
    p = line.split("|")
    assert len(p) == 8, (len(p), line)
    id_, ru, en, meals, mins, ings, sru, sen = p
    ing = []
    for x in ings.split(";"):
        fid, g = x.split(":")
        assert fid in ids, (id_, fid)
        ing.append({"food": fid, "g": float(g)})
    recipes.append({"id": id_, "ru": ru, "en": en, "meals": meals.split(","), "minutes": int(mins),
                    "ingredients": ing, "stepsRu": sru.split(";"), "stepsEn": sen.split(";")})

os.makedirs(OUT, exist_ok=True)
json.dump(foods, open(os.path.join(OUT, "foods.json"), "w", encoding="utf-8"), ensure_ascii=False, indent=0)
json.dump(recipes, open(os.path.join(OUT, "recipes.json"), "w", encoding="utf-8"), ensure_ascii=False, indent=0)
print(len(foods), "foods,", len(recipes), "recipes")
