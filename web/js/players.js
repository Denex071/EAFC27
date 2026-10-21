// Bekannte Spielernamen (Anzeige wie in EA FC) – hilft der Texterkennung, unscharf gelesene Namen
// („Mossl“ → „Messi“, „Bromer“ → „Bremer“) dem richtigen Spieler zuzuordnen. Eigene Spieler aus dem Depot haben Vorrang.
export const PLAYER_NAMES = `
Messi Ronaldo Mbappé Haaland Bellingham Vinícius Jr. Rodri De Bruyne Kane Salah Lewandowski Van Dijk Alisson Courtois Ter Stegen Oblak Maignan Donnarumma
Martínez Raya Pickford Reus Müller Hummels Götze Kroos Benzema Suárez Neymar Griezmann Lukaku David Raya Ekitiké Anyomi Onana Vicario Ederson Neuer Kobel Sommer Unai Simón Svilar Flekken Sá Verbruggen Raúl Asencio Lunin Leno Ramsdale Sánchez Henderson Pope
Szoboszlai Musiala Wirtz Pau Cubarsí Bremer Upamecano Tonali Gravenberch Caicedo Nmecha João Neves Vitinha Pedri Gavi Yamal Raphinha Olmo Lewandowski Ferran Torres
Balde Koundé Araujo Iñigo Martínez Christensen Frenkie de Jong De Jong Fermín López Casadó Rashford Dani Olmo Szczęsny García Joan García Eric García Fort
Maignan Laimer Kimmich Goretzka Pavlović Olise Gnabry Sané Coman Tah Kompany Davies Guerreiro Stanišić Boey Ito Dier Urbig Karl Kane Díaz
Schlotterbeck Brandt Adeyemi Guirassy Gittens Beier Bensebaini Ryerson Süle Can Couto Sabitzer Svensson Groß Nmecha Bynoe-Gittens Anton
Xhaka Grimaldo Frimpong Tapsoba Hincapié Boniface Schick Wirtz Andrich Palacios Tella Hlozek Terrier Garcia Quansah Tillman Hofmann Kofane
Openda Šeško Simons Raum Baumgartner Schlager Orbán Lukeba Haidara Kampl Vermeeren Nusa Diomande Xavi Simons
Haaland Foden Bernardo Silva Gündoğan Doku Grealish Gvardiol Dias Rúben Dias Akanji Stones Walker Lewis Kovačić Marmoush Savinho Khusanov Reijnders Cherki Aït-Nouri Nico González O'Reilly Bobb Trafford
Saka Ødegaard Rice Martinelli Havertz Gabriel Saliba Timber White Zinchenko Partey Jorginho Trossard Calafiori Merino Nwaneri Lewis-Skelly Madueke Gyökeres Zubimendi Eze Mosquera Nørgaard Hincapié Kepa
Salah Van Dijk Alexander-Arnold Robertson Konaté Gakpo Díaz Núñez Jota Mac Allister Szoboszlai Jones Endo Gravenberch Chiesa Kerkez Frimpong Wirtz Ekitiké Isak Leoni Elliott Bradley Gomez Mamardashvili Ngumoha
Palmer Enzo Fernández Caicedo Jackson Nkunku Mudryk Madueke Cucurella Colwill Fofana James Reece James Gusto Lavia Sancho Neto Pedro Neto Delap João Pedro Estêvão Garnacho Badiashile Chalobah Sánchez Gittens
Bruno Fernandes Rashford Mount Casemiro Mainoo Hojlund Højlund Zirkzee De Ligt Mazraoui Martínez Lisandro Martínez Dalot Shaw Yoro Ugarte Amad Diallo Šeško Mbeumo Cunha Lammens Heaven Dorgu
Son Maddison Kulusevski Romero Van de Ven Udogie Porro Vicario Bissouma Bentancur Sarr Johnson Solanke Richarlison Kudus Simons Xavi Danso Gray Odobert Palhinha Bergvall
Isak Gordon Guimarães Bruno Guimarães Tonali Joelinton Trippier Botman Schär Burn Livramento Barnes Murphy Wissa Elanga Woltemade Thiaw Ramsey
Watkins McGinn Kamara Tielemans Onana Konsa Torres Pau Torres Digne Rogers Bailey Duran Martínez Emiliano Martínez Mings Cash Asensio Rashford Maatsen Sancho Guessand
Mbeumo Wissa Schade Damsgaard Nørgaard Collins Mee Pinnock Flekken Lewis-Potter Ouattara Thiago Igor Thiago Kelleher Ajer Hickey Henry Janelt Yarmoliuk
Mitoma Welbeck Ferguson Baleba Estupiñán Dunk Van Hecke Verbruggen Minteh Adingra Gómez Hinshelwood Wieffer Gruda Kadıoğlu Rutter
Bowen Paquetá Kudus Ward-Prowse Areola Kilman Mavropanos Emerson Füllkrug Summerville Soucek Souček Wan-Bissaka Todibo Fernandes Guilherme
Wood Elanga Gibbs-White Hudson-Odoi Murillo Milenković Sels Aina Williams Anderson Domínguez Ndoye Kalimuendo Hutchinson
Mateta Eze Olise Guéhi Muñoz Wharton Lerma Henderson Sarr Richards Mitchell Lacroix Nketiah Pino Kamada
Semenyo Kluivert Kerkez Tavernier Christie Zabarnyi Huijsen Kepa Scott Evanilson Adams Tavernier Ouattara Jiménez Truffert
Iwobi Jiménez Andreas Pereira Muniz Leno Robinson Bassey Tete Smith Rowe King Wilson Lukić Berge
Pickford Calvert-Lewin Doucouré McNeil Tarkowski Branthwaite Mykolenko Garner Gueye Ndiaye Beto Barry Grealish Dewsbury-Hall O'Brien
Cunha Neto Semedo Lemina Bellegarde Larsen Strand Larsen Hwang Toti Mosquera Doherty André Gomes Munetsi Arias
Vinícius Jr. Bellingham Valverde Tchouaméni Camavinga Modrić Rodrygo Militão Éder Militão Alaba Rüdiger Carvajal Mendy Courtois Lunin Güler Endrick Brahim Ceballos Vázquez Fran García Asencio Huijsen Alexander-Arnold Carreras Mastantuono Mbappé
Griezmann Oblak Koke De Paul Llorente Marcos Llorente Giménez Witsel Molina Riquelme Barrios Gallagher Sørloth Julián Álvarez Álvarez Le Normand Lenglet Lino Galán Baena Raspadori Almada Hancko Ruggeri Musso Cardoso Simeone
Williams Nico Williams Iñaki Williams Sancet Unai Simón Vivian Paredes Yuri Berchiche Prados Guruzeta Berenguer Lekue De Marcos Jauregizar Laporte
Oyarzabal Kubo Zubimendi Remiro Merino Le Normand Aguerd Sučić Barrenetxea Méndez Brais Méndez Gómez Sergio Gómez Zakharyan Turrientes Kurić
Isco Fornals Johnny Lo Celso Abde Bartra Llorente Rui Silva Ayoze Chimy Ávila Bakambu Vitor Roque Natan Altimira Riquelme
Parejo Pépé Moleiro Gerard Moreno Baena Comesaña Foyth Kambwala Mikautadze Pépé Akhomach Mouriño Buchanan Partey Junior Firpo
Mamardashvili Pepelu Duro Almeida Diego López Mosquera Gayà Rioja Javi Guerra Hugo Duro Tárrega Danjuma
Aspas Iago Aspas Mingueza Douvikas Borja Iglesias Bamba Swedberg Jutglà Alfon Moriba Radu
Lewandowski Pedri Yamal Raphinha Olmo Gavi Fermín Casadó Cubarsí Koundé Balde Araujo Christensen Ter Stegen Szczęsny Bernal Gerard Martín Rashford Joan García Roony Bardghji
Kane Musiala Wirtz Díaz Olise Tah Kimmich Upamecano Neuer Laimer Davies Stanišić Pavlović Goretzka Gnabry Coman Jackson Boey Guerreiro Karl Urbig
Lautaro Martínez Thuram Barella Çalhanoğlu Mkhitaryan Bastoni Dimarco Dumfries Acerbi Pavard De Vrij Sommer Frattesi Zieliński Bisseck Darmian Taremi Arnautović Carlos Augusto Bonny Akanji Sučić Luis Henrique Pio Esposito
Leão Rafael Leão Pulisic Reijnders Maignan Theo Hernández Hernández Tomori Gabbia Fofana Musah Morata Abraham Loftus-Cheek Calabria Thiaw Emerson Royal Gimenez Santiago Giménez Walker Modrić Rabiot Saelemaekers Estupiñán Nkunku Pavlović Jashari De Winter
Vlahović Yıldız Locatelli Gatti Bremer Cambiaso Koopmeiners Douglas Luiz Thuram Khéphren Thuram Di Gregorio Danilo Conceição Weah Nico González Kalulu Kolo Muani David Openda Zhegrova Kelly João Mário
Osimhen Lukaku Kvaratskhelia McTominay Anguissa Lobotka Di Lorenzo Rrahmani Buongiorno Olivera Meret Politano Neres Raspadori Gilmour Spinazzola Hojlund Højlund De Bruyne Beukema Lang Milinković-Savić Lucca
Dybala Pellegrini Lukaku Svilar Mancini N'Dicka Koné Paredes Cristante Soulé Dovbyk Angeliño Celik El Shaarawy Hummels Pisilli Ndicka Wesley Ferguson Bailey El Aynaoui Ghilardi
Lookman De Ketelaere Ederson Retegui Koopmeiners Scamacca Zappacosta Kolašinac Hien Djimsiti Carnesecchi Bellanova Ruggeri Samardžić Kossounou Pašalić Maldini Krstović Sulemana Zalewski Musah
Kean Gudmundsson Guðmundsson Comuzzo Ranieri Dodô De Gea Cataldi Adli Bove Colpani Beltrán Mandragora Fagioli Dzeko Piccoli Viti Nicolussi Caviglia
Zaccagni Castellanos Guendouzi Rovella Romagnoli Gila Provedel Pedro Isaksen Dia Tavares Nuno Tavares Vecino Mattéo Guendouzi Cancellieri Belahyane
Orsolini Castro Ndoye Freuler Ferguson Skorupski Beukema Lucumí Fabbian Odgaard Holm Dallinga Immobile Bernardeschi Rowe Cambiaghi Pobega
Mbappé Dembélé Hakimi Marquinhos Vitinha Neves João Neves Zaïre-Emery Barcola Kvaratskhelia Doué Désiré Doué Ramos Gonçalo Ramos Asensio Fabián Ruiz Pacho Mendes Nuno Mendes Donnarumma Chevalier Safonov Lee Kang-in Mayulu Beraldo Zabarnyi Hernández Lucas Hernández
Aubameyang Greenwood Rabiot Harit Højbjerg Rongier Balerdi Rulli Luis Henrique Wahi Rowe Murillo Kondogbia Gouiri Maupay Pavard Aguerd Nadir Vermeeren Weah O'Riley Paixão Emerson
Lacazette Cherki Fofana Tolisso Matić Tagliafico Lukeba Mikautadze Nuamah Maitland-Niles Mata Niakhaté Perri Mangala Veretout Moreira Morton Tessmann Merah Endrick Sulc
David Zhegrova Cabella Gudmundsson Angel Gomes Diakité Chevalier Bentaleb Mukau Haraldsson André Alexsandro Ismaily Mandi Sahraoui Fernandez-Pardo Igamane
Akliouche Ben Seghir Golovin Embolo Minamino Zakaria Camara Kehrer Singo Majecki Balogun Biereth Ilenikhena Magassa Teze Vanderson Köhn Mawissa Adingra Hradecky Salisu
Sancho Lees-Melou Thauvin Openda Jakobs Thomasson Said Sima Agbadou Ganago Fofana Diouf Kakuta Sotoca Khusanov Wahi Satriano Machado Haïdara
Doumbia Kalimuendo Gouiri Blas Assignon Wooh Faes Truffert Lepaul Rieder Bourigeaud Mandanda Samba Brassier
Gyökeres Pote Trincão Hjulmand Morita Inácio Gonçalo Inácio Diomande Ousmane Diomande Quenda Catamo Harder Araújo Maxi Araújo Debast Fresneda Kochorashvili Ioannidis Suárez Luis Suárez Rui Silva Pedro Gonçalves Geny Catamo
Di María Otamendi Pavlidis Aursnes Kökçü Florentino Bah Tomás Araújo António Silva Trubin Schjelderup Akturkoglu Prestianni Dahl Barreiro Rios Richard Ríos Lukebakio Ivanović Sudakov Dedić
Pepê Galeno Samu Omorodion Varela Eustáquio Diogo Costa Nico González Otávio Pérez Martim Fernandes Mora Rodrigo Mora Kiwior Bednarek Froholdt Veiga Gabri Veiga Aghehowa Pablo Rosario Zaidu Sanusi Borja Sainz Moffi
Gakpo Xavi Simons Simons Frimpong Van Dijk Ake Aké De Ligt Dumfries Malen Bergwijn Koopmeiners Weghorst Reijnders Timber Geertruida Van de Ven Hato Hato Verbruggen Flekken Brobbey Gravenberch Lang Til Saibari Veerman Perišić
Doku Tielemans Onana Lukaku De Ketelaere Trossard Openda Bakayoko Theate Castagne Mangala Faes Meunier Lukebakio Vertonghen Debast De Cuyper Casteels Sels Lavia Raskin
Kane Saka Foden Bellingham Rice Palmer Stones Guéhi Pickford Trippier Walker Alexander-Arnold Gordon Watkins Toney Mainoo Eze Gallagher Wharton Konsa Colwill Shaw Maguire Henderson Ramsdale Madueke Rogers Spence Quansah Burn
Pulisic McKennie Weah Reyna Adams Dest Robinson Turner Balogun Pepi Tillman Musah Aaronson
Lavelle Smith Rodman Swanson Horan Girma Morgan Naeher Fox Albert Coffey Sullivan Shaw Thompson Williams Kelly Hemp Russo Toone Mead James Bronze Bright Earps Hampton Williamson Greenwood Stanway Kirby England
Putellas Bonmatí Paralluelo Caldentey Hermoso Batlle Ona Batlle Paredes Guijarro Coll Pina Graham Hansen Oshoala Rolfö Bruun Kühl Pajor Schertenberger Dabritz Popp Oberdorf Gwinn Hendrich Berger Bühl Nüsken Schüller Frohms
Katoto Diani Cascarino Geyoro Bacha Karchaoui Renard Le Sommer Malard Dali Majri Peyraud-Magnin Baltimore Bachmann Diaz De Almeida Chawinga Dumornay Dumornay Horan Bompastor Lakrar Mbock Marozsán Hegerberg Kumagai Macario Sembrant Endler
Miedema Martens Roord Beerensteyn Spitse Van de Donk Groenen Van Domselaar Janssen Brugts Snoeijs Kaptein Leuchter Nouwen Pelova Rasmussen Nüsken Kerr Foord Raso Fowler Kennedy Arnold Cooney-Cross Catley Hunt Fishlock Eriksson Seger Asllani Blackstenius Hurtig Angeldahl Kaneryd Rytting Kaneryd Zigiotti Kullberg Rolfö Lennartsson
Vinícius Neymar Marquinhos Casemiro Paquetá Militão Raphinha Rodrygo Endrick Savinho Martinelli Bremer Danilo Guimarães Alisson Ederson Bento Gabriel Magalhães Gabriel Wesley Igor Jesus Estêvão Antony Andrey Santos Luiz Henrique
Álvarez Mac Allister De Paul Romero Otamendi Molina Tagliafico Lo Celso Paredes Garnacho Dybala Montiel Lisandro Martínez Enzo Fernández Soulé Echeverri Mastantuono Paz Nico Paz Medina Senesi Balerdi Almada
Valverde Bentancur Araujo Giménez Olivera Núñez Ugarte De Arrascaeta Pellistri Ronald Araújo Rodríguez Viña Canobbio Aguirre Rochet
Díaz Luis Díaz Duran Jhon Durán Arias Lerma Sánchez Muñoz Cuesta Mojica Carrascal Ríos Quintero Borré Ospina Vargas Hinestroza
Son Kim Min-jae Hwang Hee-chan Lee Kang-in Kubo Mitoma Endo Tomiyasu Kamada Doan Ito Itakura Suzuki Minamino Machida Morita Taniguchi
Ronaldo Bruno Fernandes Bernardo Silva Leão Diogo Jota Dias Cancelo Vitinha Neves Félix João Félix Ramos Inácio Palhinha Nuno Mendes Dalot Conceição Trincão Neto Veiga Costa Semedo Otávio Ricardo Horta
Hakimi Ziyech En-Nesyri Amrabat Mazraoui Bounou Aguerd Saïss Ounahi Ezzalzouli Abde Brahim Díaz Amallah Saibari Diaz El Khannouss Akhomach Eliesse Ben Seghir Adli
Osimhen Lookman Iwobi Chukwueze Ndidi Simon Boniface Awoniyi Aina Bassey Onuachu Moffi Onyedika Sanusi Dennis
Salah Marmoush Trezeguet Elneny Hegazi Mohamed Abdelmonem Zizo
Mané Koulibaly Mendy Ndiaye Sarr Jackson Gueye Diatta Diallo Jakobs Camara Niakhaté Ciss Sabaly Seck Ismaïla Sarr Pape Matar Sarr Lamine Camara Habib Diarra
Kudus Partey Ayew Semenyo Salisu Fatawu Djiku Nuamah Sulemana Kyereh Inaki Williams
Mahrez Bennacer Aït-Nouri Atal Bensebaini Benrahma Gouiri Amoura Chaïbi Zerrouki Mandi Aouar Hadj Moussa Maza
Pulisic Kvaratskhelia Mikautadze Mamardashvili Chakvetadze Kochorashvili Zivzivadze
Modrić Gvardiol Kovačić Brozović Kramarić Perišić Livaković Sučić Baturina Pašalić Majer Stanišić Šutalo Erlić Budimir Pongračić
Mitrović Vlahović Tadić Milinković-Savić Kostić Pavlović Lukić Gudelj Samardžić Jović Živković
Lewandowski Zieliński Szczęsny Kiwior Bednarek Frankowski Świderski Piątek Moder Zalewski Skóraś Urbański Cash Kamiński Grabara Bułka
Haaland Ødegaard Sørloth Nusa Berge Bobb Ajer Østigård Wolfe Nyland Thorstvedt Aursnes Strand Larsen Schjelderup
Eriksen Højbjerg Højlund Christensen Kjær Andersen Maehle Damsgaard Hjulmand Dorgu Wind Isaksen Nørgaard Schmeichel Bah Kristensen Skov Olsen Dreyer
Isak Gyökeres Kulusevski Forsberg Lindelöf Elanga Ayari Bergvall Nygren Svanberg Karlström Olsen Hien Gudmundsson Bernhardsson Ekdal
Xhaka Akanji Elvedi Sommer Kobel Rodríguez Embolo Vargas Ndoye Freuler Zakaria Okafor Amdouni Rieder Aebischer Widmer Jashari Manzambi
Alaba Arnautović Sabitzer Laimer Baumgartner Schlager Gregoritsch Posch Danso Wöber Seiwald Grillitsch Kalajdžić Wimmer Lienhart Prass
Szoboszlai Sallai Orbán Kerkez Nagy Gulácsi Varga Dibusz Schäfer Styles
Schick Souček Coufal Hložek Krejčí Provod Šulc Chorý Kovář Staněk Holeš Zima
Çalhanoğlu Güler Yıldız Kökçü Aktürkoğlu Akaydın Demiral Kabak Bardakcı Ünal Kadıoğlu Ayhan Müldür Çakır Ozcan Özcan Uzun Bayındır Kahveci
`.trim().split(/\s+/).join(" ")
  // Mehrteilige Namen zusammenhalten
  .replace(/(?<=^| )(Vinícius Jr\.|De Bruyne|Van Dijk|Ter Stegen|Unai Simón|Raúl Asencio|Pau Cubarsí|João Neves|Ferran Torres|Iñigo Martínez|Frenkie de Jong|De Jong|Fermín López|Dani Olmo|Joan García|Eric García|Bernardo Silva|Rúben Dias|Nico González|Lewis-Skelly|Mac Allister|Alexander-Arnold|Enzo Fernández|Reece James|Pedro Neto|João Pedro|Bruno Fernandes|De Ligt|Lisandro Martínez|Amad Diallo|Van de Ven|Bruno Guimarães|Pau Torres|Emiliano Martínez|Igor Thiago|Lewis-Potter|Ward-Prowse|Wan-Bissaka|Gibbs-White|Hudson-Odoi|Calvert-Lewin|Dewsbury-Hall|Smith Rowe|Andreas Pereira|Strand Larsen|André Gomes|Éder Militão|Marcos Llorente|Julián Álvarez|Le Normand|Nico Williams|Iñaki Williams|Yuri Berchiche|De Marcos|Brais Méndez|Sergio Gómez|Rui Silva|Chimy Ávila|Vitor Roque|Gerard Moreno|Junior Firpo|Diego López|Javi Guerra|Hugo Duro|Iago Aspas|Borja Iglesias|Gerard Martín|Roony Bardghji|Lautaro Martínez|Carlos Augusto|Luis Henrique|Pio Esposito|Rafael Leão|Theo Hernández|Emerson Royal|Santiago Giménez|De Winter|Douglas Luiz|Khéphren Thuram|Di Gregorio|Kolo Muani|João Mário|Di Lorenzo|Milinković-Savić|El Shaarawy|El Aynaoui|De Ketelaere|De Gea|Nuno Tavares|Mattéo Guendouzi|Désiré Doué|Gonçalo Ramos|Fabián Ruiz|Nuno Mendes|Lee Kang-in|Lucas Hernández|Angel Gomes|Ben Seghir|Lees-Melou|Gonçalo Inácio|Ousmane Diomande|Maxi Araújo|Luis Suárez|Pedro Gonçalves|Geny Catamo|Di María|Tomás Araújo|António Silva|Richard Ríos|Diogo Costa|Martim Fernandes|Rodrigo Mora|Gabri Veiga|Pablo Rosario|Zaidu Sanusi|Borja Sainz|Xavi Simons|Graham Hansen|Ona Batlle|Le Sommer|Peyraud-Magnin|De Almeida|Van de Donk|Van Domselaar|Cooney-Cross|Gabriel Magalhães|Igor Jesus|Andrey Santos|Luiz Henrique|Nico Paz|Ronald Araújo|De Arrascaeta|Luis Díaz|Jhon Durán|Kim Min-jae|Hwang Hee-chan|Diogo Jota|João Félix|Ricardo Horta|Brahim Díaz|El Khannouss|Eliesse Ben Seghir|Ismaïla Sarr|Pape Matar Sarr|Lamine Camara|Habib Diarra|Inaki Williams|Hadj Moussa|Skov Olsen|Nico Paz|David Raya)(?= |$)/g, m => m.replace(/ /g, "_"))
  .split(" ").map(n => n.replace(/_/g, " "))
  .filter((n, i, a) => a.indexOf(n) === i);
