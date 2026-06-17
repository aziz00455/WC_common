window.teams = {
  "Mexico": { espn:"Mexico", short:"MEX", flag:"https://flagcdn.com/w40/mx.png", rank:14 },
  "South Africa": { espn:"South Africa", short:"RSA", flag:"https://flagcdn.com/w40/za.png", rank:60 },
  "Korea Republic": { espn:"South Korea", short:"KOR", flag:"https://flagcdn.com/w40/kr.png", rank:25 },
  "Czechia": { espn:"Czechia", short:"CZE", flag:"https://flagcdn.com/w40/cz.png", rank:40 },
  "Canada": { espn:"Canada", short:"CAN", flag:"https://flagcdn.com/w40/ca.png", rank:30 },
  "Bosnia and Herzegovina": { espn:"Bosnia-Herzegovina", short:"BIH", flag:"https://flagcdn.com/w40/ba.png", rank:64 },
  "Qatar": { espn:"Qatar", short:"QAT", flag:"https://flagcdn.com/w40/qa.png", rank:56 },
  "Switzerland": { espn:"Switzerland", short:"SUI", flag:"https://flagcdn.com/w40/ch.png", rank:19 },
  "Brazil": { espn:"Brazil", short:"BRA", flag:"https://flagcdn.com/w40/br.png", rank:6 },
  "Morocco": { espn:"Morocco", short:"MAR", flag:"https://flagcdn.com/w40/ma.png", rank:7 },
  "Haiti": { espn:"Haiti", short:"HAI", flag:"https://flagcdn.com/w40/ht.png", rank:83 },
  "Scotland": { espn:"Scotland", short:"SCO", flag:"https://upload.wikimedia.org/wikipedia/commons/thumb/1/10/Flag_of_Scotland.svg/40px-Flag_of_Scotland.svg.png", rank:42 },
  "USA": { espn:"United States", short:"USA", flag:"https://flagcdn.com/w40/us.png", rank:17 },
  "Paraguay": { espn:"Paraguay", short:"PAR", flag:"https://flagcdn.com/w40/py.png", rank:41 },
  "Australia": { espn:"Australia", short:"AUS", flag:"https://flagcdn.com/w40/au.png", rank:27 },
  "Türkiye": { espn:"Türkiye", short:"TUR", flag:"https://flagcdn.com/w40/tr.png", rank:22 },
  "Germany": { espn:"Germany", short:"GER", flag:"https://flagcdn.com/w40/de.png", rank:10 },
  "Curaçao": { espn:"Curaçao", short:"CUR", flag:"https://flagcdn.com/w40/cw.png", rank:82 },
  "Côte d'Ivoire": { espn:"Ivory Coast", short:"CIV", flag:"https://flagcdn.com/w40/ci.png", rank:33 },
  "Ecuador": { espn:"Ecuador", short:"ECU", flag:"https://flagcdn.com/w40/ec.png", rank:23 },
  "Netherlands": { espn:"Netherlands", short:"NED", flag:"https://flagcdn.com/w40/nl.png", rank:8 },
  "Japan": { espn:"Japan", short:"JPN", flag:"https://flagcdn.com/w40/jp.png", rank:18 },
  "Tunisia": { espn:"Tunisia", short:"TUN", flag:"https://flagcdn.com/w40/tn.png", rank:45 },
  "Sweden": { espn:"Sweden", short:"SWE", flag:"https://flagcdn.com/w40/se.png", rank:38 },
  "Belgium": { espn:"Belgium", short:"BEL", flag:"https://flagcdn.com/w40/be.png", rank:9 },
  "Egypt": { espn:"Egypt", short:"EGY", flag:"https://flagcdn.com/w40/eg.png", rank:29 },
  "IR Iran": { espn:"Iran", short:"IRN", flag:"https://flagcdn.com/w40/ir.png", rank:20 },
  "New Zealand": { espn:"New Zealand", short:"NZL", flag:"https://flagcdn.com/w40/nz.png", rank:85 },
  "Spain": { espn:"Spain", short:"ESP", flag:"https://flagcdn.com/w40/es.png", rank:2 },
  "Cabo Verde": { espn:"Cape Verde", short:"CPV", flag:"https://flagcdn.com/w40/cv.png", rank:67 },
  "Saudi Arabia": { espn:"Saudi Arabia", short:"KSA", flag:"https://flagcdn.com/w40/sa.png", rank:61 },
  "Uruguay": { espn:"Uruguay", short:"URU", flag:"https://flagcdn.com/w40/uy.png", rank:16 },
  "France": { espn:"France", short:"FRA", flag:"https://flagcdn.com/w40/fr.png", rank:3 },
  "Senegal": { espn:"Senegal", short:"SEN", flag:"https://flagcdn.com/w40/sn.png", rank:15 },
  "Iraq": { espn:"Iraq", short:"IRQ", flag:"https://flagcdn.com/w40/iq.png", rank:57 },
  "Norway": { espn:"Norway", short:"NOR", flag:"https://flagcdn.com/w40/no.png", rank:31 },
  "Argentina": { espn:"Argentina", short:"ARG", flag:"https://flagcdn.com/w40/ar.png", rank:1 },
  "Algeria": { espn:"Algeria", short:"ALG", flag:"https://flagcdn.com/w40/dz.png", rank:28 },
  "Austria": { espn:"Austria", short:"AUT", flag:"https://flagcdn.com/w40/at.png", rank:24 },
  "Jordan": { espn:"Jordan", short:"JOR", flag:"https://flagcdn.com/w40/jo.png", rank:63 },
  "Portugal": { espn:"Portugal", short:"POR", flag:"https://flagcdn.com/w40/pt.png", rank:5 },
  "Congo DR": { espn:"Congo DR", short:"COD", flag:"https://flagcdn.com/w40/cd.png", rank:46 },
  "Uzbekistan": { espn:"Uzbekistan", short:"UZB", flag:"https://flagcdn.com/w40/uz.png", rank:50 },
  "Colombia": { espn:"Colombia", short:"COL", flag:"https://flagcdn.com/w40/co.png", rank:13 },
  "England": { espn:"England", short:"ENG", flag:"https://upload.wikimedia.org/wikipedia/en/thumb/b/be/Flag_of_England.svg/40px-Flag_of_England.svg.png", rank:4 },
  "Croatia": { espn:"Croatia", short:"CRO", flag:"https://flagcdn.com/w40/hr.png", rank:11 },
  "Ghana": { espn:"Ghana", short:"GHA", flag:"https://flagcdn.com/w40/gh.png", rank:73 },
  "Panama": { espn:"Panama", short:"PAN", flag:"https://flagcdn.com/w40/pa.png", rank:34 }
};

window.getTeam = function(name) {
  return window.teams?.[name] || null;
};

window.getTeamFlag = function(name) {
  return window.teams?.[name]?.flag || "";
};

window.getTeamRank = function(name) {
  return window.teams?.[name]?.rank || null;
};