let accidents = [];
let articles = [];
let editAccidentPersons = [];
let watchEndOfPage = false;
let spinnerLoadCard;
let pageType;
let TpageType = Object.freeze({stream:0, accident:1, moderations:2, statistics:3});

function initMain() {
  initPage();

  spinnerLoadCard = document.getElementById('spinnerLoad');

  const url        = new URL(location.href);
  const accidentID = getAccidentNumberFromPath(url.pathname);
  const articleID  = url.searchParams.get('articleid');
  const searchText = url.searchParams.get('search');

  if (url.pathname.startsWith('/moderaties'))        pageType = TpageType.moderations;
  else if (url.pathname.startsWith('/statistieken')) pageType = TpageType.statistics;
  else if (accidentID)                               pageType = TpageType.accident;
  else                                               pageType = TpageType.stream;

  if (searchText) {
    const div = document.getElementById('searchText');
    div.value = searchText;
    div.style.display = 'inline-block';
  }

  addEditPersonButtons();

  if (pageType === TpageType.statistics) {
    loadStatistics();
  } else if (pageType === TpageType.accident){
    // Single accident details page
    loadAccidents(accidentID, articleID);
  } else {
    // Infinity scroll event
    // TODO: Switch to IntersectionObserver. Not yet supported by Safari :(
    document.addEventListener("scroll", (event) => {
      if (watchEndOfPage) {
        if ((spinnerLoadCard.style.display==='block') && isScrolledIntoView(spinnerLoadCard)) {
          watchEndOfPage = false;
          loadAccidents();
        }
      }
    });

    loadAccidents();
  }
}

async function loadStatistics(){
  function htmlPeriod(label, period){
    return `
    <div class="flexColumn">
      <div class="smallStats">${label}</div> 
      <div class="statsIcons"><div class="iconXS bgDead"></div> ${period.personsdead} <div class="iconXS bgInjured" style="margin-left: 5px;"></div> ${period.personsinjured} </div>
    </div>`;
  }

  try {
    spinnerLoadCard.style.display = 'block';

    let url          = '/ajax.php?function=getstats';
    const response = await fetch(url, fetchOptions);
    const text     = await response.text();
    data           = JSON.parse(text);
    if (data.user) updateLoginGUI(data.user);
    if (data.error) showError(data.error);
    else {
      const stats = data.statistics;
      document.getElementById('statistics').innerHTML = `
<div class="statsRow">
${htmlPeriod('Vandaag',  stats.today)}
${htmlPeriod('Gisteren', stats.yesterday)}
${htmlPeriod('7 dagen',  stats.last7days)}
${htmlPeriod('2018',     stats.thisyear)}
</div>
`;
    }
  } catch (error) {
    showError(error.message);
  } finally {
    spinnerLoadCard.style.display = 'none';
  }
}

async function loadAccidents(accidentID=null, articleID=null){
  function showAccidents(accidents){
    if (accidents.length === 0) {
      let text = '';
      if (pageType === TpageType.moderations) text = 'Geen moderaties gevonden';
      else text = 'Geen ongelukken gevonden';

      document.getElementById('cards').innerHTML = `<div style="text-align: center;">${text}</div>`;
      return;
    }

    let html = '';
    for (let accident of accidents) html += getAccidentHTML(accident.id);

    document.getElementById('cards').innerHTML += html;
    tippy('[data-tippy-content]');
  }

  let data;
  let maxLoadCount = 20;
  try {
    spinnerLoadCard.style.display = 'block';
    const searchText = document.getElementById('searchText').value.trim().toLowerCase();
    let url          = '/ajax.php?function=loadaccidents&count=' + maxLoadCount + '&offset=' + accidents.length;
    if (accidentID)                         url += '&id=' + accidentID;
    if (searchText)                         url += '&search=' + encodeURIComponent(searchText);
    if (pageType === TpageType.moderations) url += '&moderations=1';
    const response = await fetch(url, fetchOptions);
    const text     = await response.text();
    data           = JSON.parse(text);
    if (data.user) updateLoginGUI(data.user);
    if (data.error) showError(data.error);
    else {
      data.accidents.forEach(a => {
        a.date           = new Date(a.date);
        a.createtime     = new Date(a.createtime);
        a.streamdatetime = new Date(a.streamdatetime);
        let id = 1;
        a.persons.forEach(person => {person.id = id; id++});
      });
      data.articles.forEach(a => {
        a.publishedtime  = new Date(a.publishedtime);
        a.createtime     = new Date(a.createtime);
        a.streamdatetime = new Date(a.streamdatetime);
      });

      accidents = accidents.concat(data.accidents);
      articles  = articles.concat(data.articles);
    }
  } catch (error) {
    showError(error.message);
  } finally {
    // Hide spinner if all data is loaded
    if (data.accidents.length < maxLoadCount) spinnerLoadCard.style.display = 'none';
  }

  if (accidentID && (accidents.length === 1)){
    document.title = accidents[0].title + ' | Het Ongeluk';
  }
  showAccidents(data.accidents);
  highlightSearchText();

  setTimeout(()=>{
    if (articleID) selectArticle(articleID);
    watchEndOfPage = true;
  }, 1);
}

function getAccidentHTML(accidentID){
  const accident        = getAccidentFromID(accidentID);
  const articles        = getAccidentArticles(accident.id);
  const canEditAccident = user.moderator || (accident.userid === user.id);

  let htmlArticles = '';
  for (let article of articles) {
    let htmlModeration = '';
    if (article.awaitingmoderation){
      let modHTML = '';
      if (user.moderator) modHTML = `
Lieve moderator, dit artikel van "${article.user}" wacht op moderatie.
<div style="margin: 10px;">
  <button class="button" onclick="articleModerateOK(${article.id})">Keur artikel goed</button>
  <button class="button buttonGray" onclick="deleteArticle(${article.id})">Verwijder artikel</button>
</div>
`;
      else if (article.userid === user.id) modHTML = 'Bedankt voor het toevoegen van dit artikel. Je bijdrage wordt spoedig gemodereerd en is tot die tijd nog niet voor iedereen zichtbaar.';
      else modHTML = 'Dit artikel wordt spoedig gemodereerd en is tot die tijd nog niet zichtbaar op de voorpagina.';

      htmlModeration = `<div id="articleModeration${article.id}" class="moderation" onclick="event.stopPropagation()">${modHTML}</div>`;
    }

    htmlArticles +=`
<div class="cardArticle" id="article${article.id}" onclick="openArticleLink(event, ${article.id})">
  <div class="articleImageWrapper"><img class="articleImage" src="${article.urlimage}" onerror="this.style.display='none';"></div>
  <div class="articleBody">
    <span class="postButtonArea" onclick="event.stopPropagation();">
      <span style="position: relative;"><span class="buttonEditPost buttonDetails" data-userid="${article.userid}" onclick="showArticleMenu(event, ${article.id});"></span></span>
      <div id="menuArticle${article.id}" class="buttonPopupMenu" onclick="event.preventDefault();">
        <div onclick="editArticle(${accident.id},  ${article.id});">Bewerken</div>
        <div onclick="deleteArticle(${article.id})">Verwijderen</div>
      </div>            
    </span>   
    
    ${htmlModeration}     
  
    <div class="smallFont"><span class="cardSitename">${escapeHtml(article.sitename)}</span> • ${dateToAge(article.publishedtime)}</div>
  
    <div class="articleTitle">${escapeHtml(article.title)}</div>
    <div class="postText">${escapeHtml(article.text)}</div>
  </div>
</div>`;
  }

  let htmlInvolved = '';
  if (accident.child)       htmlInvolved += '<div class="iconSmall bgChild"  data-tippy-content="Kind(eren)"></div>';
  if (accident.pet)         htmlInvolved += '<div class="iconSmall bgPet"  data-tippy-content="Dier(en)"></div>';
  if (accident.alcohol)     htmlInvolved += '<div class="iconSmall bgAlcohol"  data-tippy-content="Alcohol/Drugs"></div>';
  if (accident.hitrun)      htmlInvolved += '<div class="iconSmall bgHitRun"  data-tippy-content="Doorrijden/Vluchten"></div>';
  if (accident.trafficjam)  htmlInvolved += '<div class="iconSmall bgTrafficJam"  data-tippy-content="File/Hinder"></div>';
  if (accident.tree)        htmlInvolved += '<div class="iconSmall bgTree"  data-tippy-content="Boom/Paal"></div>';

  if (htmlInvolved){
    htmlInvolved = `
    <div data-info="preventFullBorder">
      <div class="accidentIcons" onclick="event.stopPropagation();">
        <div class="flexRow" style="justify-content: flex-end">${htmlInvolved}</div>
      </div>
    </div>`;
  }

  let streamHeader = '';
  if (accident.streamtopuser) {
    switch (accident.streamtoptype) {
      case 1: streamHeader = 'aangepast door ' + accident.streamtopuser; break;
      case 2: streamHeader = 'nieuw artikel toegevoegd door ' + accident.streamtopuser; break;
      case 3: streamHeader = 'omhoog geplaatst door ' + accident.streamtopuser; break;
    }
    if (streamHeader) streamHeader += ' ' + datetimeToAge(accident.streamdatetime);
  } else {
    streamHeader = 'aangemaakt door ' + accident.user + ' ' + datetimeToAge(accident.createtime);
  }

  let htmlPersons = '';
  for (const person of accident.persons) htmlPersons += getPersonButtonHTML(person);

  let htmlModeration = '';
  if (accident.awaitingmoderation){
    let modHTML = '';
    if (user.moderator) modHTML = `
Lieve moderator, deze bijdrage van "${accident.user}" wacht op moderatie.
<div style="margin: 10px;">
  <button class="button" onclick="accidentModerateOK(${accident.id})">Keur bijdrage goed</button>
  <button class="button buttonGray" onclick="deleteAccident(${accident.id})">Verwijder bijdrage</button>
</div>
`;
    else if (accident.userid === user.id) modHTML = 'Bedankt voor het toevoegen van onderstaand bericht. Je bijdrage wordt spoedig gemodereerd en is tot die tijd nog niet voor iedereen zichtbaar.';
    else modHTML = 'Deze bijdrage wordt spoedig gemodereerd en is tot die tijd nog niet zichtbaar op de voorpagina.';

    htmlModeration = `<div id="accidentModeration${accident.id}" class="moderation" onclick="event.stopPropagation()">${modHTML}</div>`;
  }

  let htmlMenuEditItems = '';
  if (canEditAccident) {
    htmlMenuEditItems = `
      <div onclick="addPersonToAccident(${accident.id});">Persoon toevoegen</div>
      <div onclick="editAccident(${accident.id});">Bewerken</div>
      <div onclick="deleteAccident(${accident.id});">Verwijderen</div>
`;
  }

  let htmlMenuItemStreamTop = user.moderator? '<div onclick="accidentToTopStream(${accident.id});" data-moderator>Plaats bovenaan stream</div>' : '';

  return `
<div id="accident${accident.id}" class="cardAccident" onclick="showAccidentDetails(${accident.id})">
  <span class="postButtonArea" onclick="event.stopPropagation();">
    <span style="position: relative;"><span class="buttonEditPost buttonDetails"  data-userid="${accident.userid}" onclick="showAccidentMenu(event, ${accident.id});"></span></span>
    <div id="menuAccident${accident.id}" class="buttonPopupMenu" onclick="event.preventDefault();">
      <div onclick="addArticleToAccident(${accident.id});">Artikel toevoegen</div>
      ${htmlMenuEditItems}
      ${htmlMenuItemStreamTop}
    </div>            
  </span>        

  ${htmlModeration}
   
  <div class="cardTop">
    <div style="width: 100%;">
      <div class="smallFont cardTitleSmall">${dateToAge(accident.date)} | ${streamHeader}</div>
      <div class="cardTitle">${escapeHtml(accident.title)}</div>
      <div id="accidentPersons${accident.id}">${htmlPersons}</div>
    </div>
    ${htmlInvolved}
  </div>

  <div class="postText">${escapeHtml(accident.text)}</div>    
  
  ${htmlArticles}
</div>`;
}

function getPersonButtonHTML(person) {
  const bgTransportation = transportationModeImage(person.transportationmode);
  const bgHealth         = healthImage(person.health);
  const tooltip          = 'Vervoersmiddel: ' + transportationModeText(person.transportationmode) +
    '<br>Letsel: ' + healthText(person.health);
  return `<div class="accidentPerson" data-tippy-content="${tooltip}"><div class="iconMedium ${bgTransportation}"></div><div class="iconMedium ${bgHealth}"></div></div>`;
}

function highlightSearchText() {
  const search = document.getElementById('searchText').value.trim().toLowerCase().replace(/[+-]/g, '');

  if (search) {
    let options = {
      "accuracy": {
        "value":    "exactly",
        "limiters": [",", "."]
      },
      "wildcards": "enabled",
    };
    let marker = new Mark(document.querySelectorAll('.cardTitle, .articleTitle, .postText'));
    marker.mark(search, options);
  }
}

function selectArticle(articleID, smooth=false) {
  const div = document.getElementById('article' + articleID);
  if (smooth){
    div.scrollIntoView({
      block:    'center',
      behavior: 'smooth',
      inline:   'nearest'});

  } else scrollIntoViewIfNeeded(div);
}

function selectAccident(accidentID, smooth=false) {
  const div = document.getElementById('accident' + accidentID);
  if (smooth){
    div.scrollIntoView({
      block:    'center',
      behavior: 'smooth',
      inline:   'nearest'});

  } else scrollIntoViewIfNeeded(div);
}

function showEditAccidentForm(event) {
  if (! user.loggedin){
     showLoginForm();
     return;
  }

  document.getElementById('editHeader').innerText                 = 'Nieuw artikel en ongeluk toevoegen';
  document.getElementById('buttonSaveArticle').value              = 'Opslaan';
  document.getElementById('accidentIDHidden').value               = '';
  document.getElementById('articleIDHidden').value                = '';

  document.getElementById('editArticleUrl').value                 = '';
  document.getElementById('editArticleTitle').value               = '';
  document.getElementById('editArticleText').value                = '';
  document.getElementById('editArticleUrlImage').value            = '';
  document.getElementById('editArticleSiteName').value            = '';
  document.getElementById('editArticleDate').value                = '';

  document.getElementById('editAccidentTitle').value               = '';
  document.getElementById('editAccidentText').value                = '';
  document.getElementById('editAccidentDate').value                = '';

  document.getElementById('editAccidentChild').classList.remove('buttonSelected');
  document.getElementById('editAccidentPet').classList.remove('buttonSelected');
  document.getElementById('editAccidentAlcohol').classList.remove('buttonSelected');
  document.getElementById('editAccidentHitRun').classList.remove('buttonSelected');
  document.getElementById('editAccidentTrafficJam').classList.remove('buttonSelected');
  document.getElementById('editAccidentTree').classList.remove('buttonSelected');

  editAccidentPersons = [];
  refreshAccidentPersonsGUI(editAccidentPersons);

  document.querySelectorAll('[data-hideedit]').forEach(d => {d.style.display = 'inline-block';});

  document.getElementById('editAccidentSection').style.display = 'flex';
  document.getElementById('editArticleSection').style.display  = 'flex';

  document.getElementById('formEditAccident').style.display    = 'flex';

  document.getElementById('editArticleUrl').focus();

  document.querySelectorAll('[data-readonlyhelper]').forEach(d => {d.readOnly = ! user.moderator;});
  document.querySelectorAll('[data-hidehelper]').forEach(d => {d.style.display = ! user.moderator? 'none' : 'flex';});
}

function addEditPersonButtons(){
  let htmlButtons = '';
  for (const key of Object.keys(TTransportationMode)){
    const transportationMode =  TTransportationMode[key];
    const bgClass            = transportationModeImage(transportationMode);
    const text               = transportationModeText(transportationMode);
    htmlButtons += `<span id="editPersonTransportationMode${key}" class="menuButton ${bgClass}" data-tippy-content="${text}" onclick="selectPersonTransportationMode(${transportationMode});"></span>`;
  }
  document.getElementById('personTransportationButtons').innerHTML = htmlButtons;

  htmlButtons = '';
  for (const key of Object.keys(THealth)){
    const health =  THealth[key];
    const bgClass = healthImage(health);
    const text    = healthText(health);
    htmlButtons += `<span id="editPersonHealth${key}" class="menuButton ${bgClass}" data-tippy-content="${text}" onclick="selectPersonHealth(${health});"></span>`;
  }
  document.getElementById('personHealthButtons').innerHTML = htmlButtons;
}

function showEditPersonForm(personID=null, accidentID=null, saveDirectly=false) {
  closeAllPopups();
  const person = getPersonFromID(personID);

  document.getElementById('editPersonHeader').innerText       = person? 'Persoon bewerken' : 'Nieuw persoon toevoegen';
  document.getElementById('personIDHidden').value             = person? person.id : '';
  document.getElementById('personAccidentIDHidden').value     = accidentID? accidentID : '';
  document.getElementById('buttonDeletePerson').style.display = person? 'inline-flex' : 'none';
  document.getElementById('personSaveDirectly').value         = saveDirectly;

  selectPersonTransportationMode(person? person.transportationmode : null);
  selectPersonHealth(person? person.health : null);

  document.getElementById('formEditPerson').style.display = 'flex';
}

function selectPersonTransportationMode(transportationMode){
  for (const key of Object.keys(TTransportationMode)) {
    const buttonTransportationMode = TTransportationMode[key];
    const button = document.getElementById('editPersonTransportationMode' + key);
    if (buttonTransportationMode === transportationMode) button.classList.add('buttonSelected');
    else button.classList.remove('buttonSelected');
  }
}

function getSelectedPersonTransportationMode(){
  for (const key of Object.keys(TTransportationMode)) {
    const buttonTransportationMode = TTransportationMode[key];
    const button = document.getElementById('editPersonTransportationMode' + key);
    if (button.classList.contains('buttonSelected')) return buttonTransportationMode;
  }
  return null;
}

function selectPersonHealth(health) {
  for (const key of Object.keys(THealth)) {
    const buttonHealth = THealth[key];
    const button = document.getElementById('editPersonHealth' + key);
    if (buttonHealth === health) button.classList.add('buttonSelected');
    else button.classList.remove('buttonSelected');
  }
}

function getSelectedPersonHealth(){
  for (const key of Object.keys(THealth)) {
    const buttonHealth = THealth[key];
    const button = document.getElementById('editPersonHealth' + key);
    if (button.classList.contains('buttonSelected')) return buttonHealth;
  }
  return null;
}

function closeEditPersonForm(){
  document.getElementById('formEditPerson').style.display = 'none';
}

function savePerson() {
  async function savePersonToServer(person) {
    const url = '/ajax.php?function=addPersonToAccident';
    const optionsFetch = {
      method:  'POST',
      body: JSON.stringify({person: person}),
      headers: {'Content-Type': 'application/json'},
    };
    const response = await fetch(url, optionsFetch);
    const text     = await response.text();
    const data     = JSON.parse(text);
    if (data.error) {
      showError(data.error, 10);
    } else {
      const accident = getAccidentFromID(person.accidentid);
      accident.persons.push(person);
      person.id = accident.persons.length;
      const divID = 'accidentPersons' + person.accidentid;
      document.getElementById(divID).innerHTML += getPersonButtonHTML(person);
      tippy('[data-tippy-content]');
      showMessage('Persoon toegevoegd');
    }
  }

  const selectedTransportationMode = getSelectedPersonTransportationMode();
  const selectedHealth             = getSelectedPersonHealth();
  const saveDirectly               = document.getElementById('personSaveDirectly').value === "true";
  if (selectedTransportationMode === null) {showError('Geen vervoersmiddel geselecteerd', 3); return;}
  if (selectedHealth             === null) {showError('Geen letsel geselecteerd', 3); return;}

  const personID = parseInt(document.getElementById('personIDHidden').value);
  let person;
  if (personID){
    person = getPersonFromID(personID);
    person.transportationmode = selectedTransportationMode;
    person.health             = selectedHealth;
  } else {
    person = {
      id:                 editAccidentPersons.length + 1,
      transportationmode: selectedTransportationMode,
      health:             selectedHealth};

    if (saveDirectly === true){
      person.accidentid = parseInt(document.getElementById('personAccidentIDHidden').value);
      savePersonToServer(person);
    } else {
      editAccidentPersons.push(person);
    }
  }

  refreshAccidentPersonsGUI(editAccidentPersons);

  closeEditPersonForm();
}

function deletePerson() {
  confirmMessage('Persoon verwijderen?',
    function () {
      const personID      = parseInt(document.getElementById('personIDHidden').value);
      editAccidentPersons = editAccidentPersons.filter(person => person.id !== personID);
      refreshAccidentPersonsGUI(editAccidentPersons);
      closeEditPersonForm();
    });
}

function refreshAccidentPersonsGUI(persons=[]) {
  let html = '';

  for (let person of persons){
    const iconTransportation = transportationModeIcon(person.transportationmode);
    const iconHealth         = healthIcon(person.health);
    html += `<div class="editAccidentPerson" onclick="showEditPersonForm(${person.id});">
${iconTransportation} ${iconHealth}
</div>
`;
  }

  document.getElementById('editAccidentPersons').innerHTML = html;
  tippy('[data-tippy-content]');
}

function setNewArticleAccidentFields(accidentID){
  const accident = getAccidentFromID(accidentID);
  const accidentDatetime = new Date(accident.date);

  // Shallow copy
  editAccidentPersons = clone(accident.persons);

  document.getElementById('accidentIDHidden').value           = accident.id;

  document.getElementById('editAccidentTitle').value          = accident.title;
  document.getElementById('editAccidentText').value           = accident.text;
  document.getElementById('editAccidentDate').value           = dateToISO(accidentDatetime);

  selectButton('editAccidentChild',       accident.child);
  selectButton('editAccidentPet',         accident.pet);
  selectButton('editAccidentAlcohol',     accident.alcohol);
  selectButton('editAccidentHitRun',      accident.hitrun);
  selectButton('editAccidentTrafficJam',  accident.trafficjam);
  selectButton('editAccidentTree',        accident.tree);

  refreshAccidentPersonsGUI(accident.persons);
}

function openArticleLink(event, articleID) {
  event.stopPropagation();
  const article = getArticleFromID(articleID);
  window.open(article.url,"article");
}

function editArticle(accidentID, articleID) {
  closeAllPopups();
  showEditAccidentForm();
  setNewArticleAccidentFields(accidentID);

  const article = getArticleFromID(articleID);

  document.getElementById('editHeader').innerText      = 'Artikel bewerken';
  document.getElementById('buttonSaveArticle').value          = 'Opslaan';

  document.getElementById('articleIDHidden').value            = article? article.id : '';

  document.getElementById('editArticleUrl').value             = article.url;
  document.getElementById('editArticleTitle').value           = article.title;
  document.getElementById('editArticleText').value            = article.text;
  document.getElementById('editArticleUrlImage').value        = article.urlimage;
  document.getElementById('editArticleSiteName').value        = article.sitename;
  document.getElementById('editArticleDate').value            = dateToISO(article.publishedtime);

  document.getElementById('formEditAccident').style.display    = 'flex';
  document.getElementById('editAccidentSection').style.display = 'none';
}

function addArticleToAccident(accidentID) {
  closeAllPopups();

  showEditAccidentForm();
  setNewArticleAccidentFields(accidentID);

  document.getElementById('editHeader').innerText              = 'Artikel toevoegen';
  document.getElementById('editAccidentSection').style.display = 'none';
}

function addPersonToAccident(accidentID) {
  showEditPersonForm(null, accidentID, true);
}

function editAccident(accidentID) {
  closeAllPopups();

  showEditAccidentForm();
  setNewArticleAccidentFields(accidentID);

  document.getElementById('editHeader').innerText                 = 'Ongeluk bewerken';
  document.getElementById('editArticleSection').style.display     = 'none';

  document.querySelectorAll('[data-hideedit]').forEach(d => {d.style.display = 'none';});
}

async function accidentToTopStream(accidentID) {
  closeAllPopups();

  const url = '/ajax.php?function=accidentToTopStream&id=' + accidentID;
  const response = await fetch(url, fetchOptions);
  const text     = await response.text();
  const data     = JSON.parse(text);
  if (data.error) showError(data.error, 10);
  else window.location.reload();
}

async function accidentModerateOK(accidentID) {
  closeAllPopups();

  const url = '/ajax.php?function=accidentModerateOK&id=' + accidentID;
  const response = await fetch(url, fetchOptions);
  const text     = await response.text();
  const data     = JSON.parse(text);
  if (data.error) showError(data.error, 10);
  else if (data.ok){
    // Remove moderation div
    getAccidentFromID(accidentID).awaitingmoderation = false;
    const divModeration = document.getElementById('accidentModeration' + accidentID);
    divModeration.remove();
  }
}

async function articleModerateOK(articleID) {
  closeAllPopups();

  const url = '/ajax.php?function=articleModerateOK&id=' + articleID;
  const response = await fetch(url, fetchOptions);
  const text     = await response.text();
  const data     = JSON.parse(text);
  if (data.error) showError(data.error, 10);
  else if (data.ok){
    // Remove moderation div
    getArticleFromID(articleID).awaitingmoderation = false;
    const divModeration = document.getElementById('articleModeration' + articleID);
    divModeration.remove();
  }
}

function domainBlacklisted(url){
  let domainBlacklist = [
    {domain: 'assercourant.nl',   reason: 'Website staat foto embedding niet toe wegens buggy cookie firewall (Dec 2018).'},
    {domain: 'drimble.nl',        reason: 'Drimble is geen media website, maar een nieuws verzamelwebsite. Zoek de bron op de drimble.nl pagina en plaats die.'},
    {domain: 'onswestbrabant.nl', reason: 'Website staat vol met buggy tags (Dec 2018).'},
  ];
  return domainBlacklist.find(d => url.includes(d.domain));
}

function copyAccidentInfoFromArticle(){
  document.getElementById('editAccidentTitle').value = document.getElementById('editArticleTitle').value;
}

function copyAccidentDateFromArticle(){
  document.getElementById('editAccidentDate').value  = document.getElementById('editArticleDate').value;
}

async function getArticleMetaData() {
  function showMetaData(meta){
    document.getElementById('editArticleUrl').value      = meta.url;
    document.getElementById('editArticleTitle').value    = meta.title;
    document.getElementById('editArticleText').value     = meta.description;
    document.getElementById('editArticleUrlImage').value = meta.urlimage;
    document.getElementById('editArticleSiteName').value = meta.sitename;
    if (meta.published_time){
      try {
        const datetime = new Date(meta.published_time);
        document.getElementById('editArticleDate').value = dateToISO(datetime);
      } catch (e) {
        // Do nothing
      }
    }
    if (meta.title === '') showMessage('Tarantula heeft geen gegevens gevonden in de web pagina.', 30);
  }

  let urlArticle = document.getElementById('editArticleUrl').value.trim();
  if (! urlArticle) {
    showError('Geen artikel link (URL) ingevuld');
    return;
  }

  const domain = domainBlacklisted(urlArticle);
  if (domain) {
    showMessage(`Links van "${domain.domain}" kunnen niet worden toegevoegd. ${domain.reason}`, 30);
    return
  }

  const isNewAccident = document.getElementById('accidentIDHidden').value === '';
  const url = '/ajax.php?function=getPageMetaData';
  const optionsFetch = {
    method: 'POST',
    body:   JSON.stringify({url: urlArticle, newarticle: isNewAccident}),
    headers:{'Content-Type': 'application/json'}
  };

  document.getElementById('spinnerMeta').style.display = 'flex';
  document.getElementById('tarantuleResults').innerHTML = '<img src="/images/spinner.svg" style="height: 30px;">';
  try {
    const response = await fetch(url, optionsFetch);
    const text     = await response.text();
    if (! text) showError('No response from server');
    const data     = JSON.parse(text);
    if (data.error) showError(data.error);
    else {
      showMetaData(data.media);

      if (data.urlexists) showMessage(`Bericht is al toegevoegd aan database. <a href='/${data.urlexists.accidentid}' style='text-decoration: underline;'>Klik hier.</a>`, 30);

      document.getElementById('tarantuleResults').innerHTML = `Gevonden:<br>
Open Graph Facebook tags: ${data.tagcount.og}<br>
Twitter tags: ${data.tagcount.twitter}<br>
article tags: ${data.tagcount.article}<br>
itemprop tags: ${data.tagcount.itemprop}<br>
other tags: ${data.tagcount.other}
`;
    }
  } catch (error) {
    showError(error.message);
  } finally {
    setTimeout(()=>{document.getElementById('spinnerMeta').style.display = 'none';}, 1500);
  }
}

async function saveArticleAccident(){
  let accident;
  let article;

  const saveArticle = document.getElementById('editArticleSection').style.display !== 'none';
  if (saveArticle){
    article = {
      id:       document.getElementById('articleIDHidden').value,
      url:      document.getElementById('editArticleUrl').value,
      title:    document.getElementById('editArticleTitle').value,
      text:     document.getElementById('editArticleText').value,
      sitename: document.getElementById('editArticleSiteName').value,
      urlimage: document.getElementById('editArticleUrlImage').value,
      date:     document.getElementById('editArticleDate').value,
    };
    if (article.id)  article.id  = parseInt(article.id);

    const domain = domainBlacklisted(article.url);
    if (domain) {
      showError(`Website ${domain.domain} kan niet worden toegevoegd. Reden: ${domain.reason}`);
      return
    }

    if (! article.url)                          {showError('Geen artikel link ingevuld'); return;}
    if (! article.title)                        {showError('Geen artikel titel ingevuld'); return;}
    if (! article.text)                         {showError('Geen artikel tekst ingevuld'); return;}
    if (article.urlimage.startsWith('http://')) {showError('Artikel foto link is onveilig. Begint met "http:". Probeer of de "https:" versie werkt. Laat anders dit veld leeg.'); return;}
    if (! article.sitename)                     {showError('Geen artikel mediabron ingevuld'); return;}
    if (! article.date)                         {showError('Geen artikel datum ingevuld'); return;}
  }

  accident = {
    id:         document.getElementById('accidentIDHidden').value,
    title:      document.getElementById('editAccidentTitle').value,
    text:       document.getElementById('editAccidentText').value,
    date:       document.getElementById('editAccidentDate').value,
    persons:    editAccidentPersons,
    child:      document.getElementById('editAccidentChild').classList.contains('buttonSelected'),
    pet:        document.getElementById('editAccidentPet').classList.contains('buttonSelected'),
    alcohol:    document.getElementById('editAccidentAlcohol').classList.contains('buttonSelected'),
    hitrun:     document.getElementById('editAccidentHitRun').classList.contains('buttonSelected'),
    trafficjam: document.getElementById('editAccidentTrafficJam').classList.contains('buttonSelected'),
    tree:       document.getElementById('editAccidentTree').classList.contains('buttonSelected'),
  };

  if (accident.id) accident.id = parseInt(accident.id);

  const saveAccident = document.getElementById('editAccidentSection').style.display !== 'none';
  if (saveAccident){
    if (saveArticle && (! user.moderator)) accident.title = article.title;
    if (!accident.title)               {showError('Geen ongeluk titel ingevuld'); return;}
    if (!accident.date)                {showError('Geen ongeluk datum ingevuld'); return;}
    if (accident.persons.length === 0) {showError('Geen personen toegevoegd'); return;}
  }

  const url = '/ajax.php?function=saveArticleAccident';
  const optionsFetch = {
    method:  'POST',
    body: JSON.stringify({
      article:      article,
      accident:     accident,
      savearticle:  saveArticle,
      saveaccident: saveAccident,
    }),
    headers: {'Content-Type': 'application/json'},
  };
  const response = await fetch(url, optionsFetch);
  const text     = await response.text();
  const data     = JSON.parse(text);
  if (data.error) {
    showError(data.error, 10);
  } else {
    let text = '';
    if (article) {
      text = article.id? 'Artikel opgeslagen' : 'Artikel toegevoegd';
    } else text = 'Ongeluk opgeslagen';

    showMessage(text, 1);
    hideDiv('formEditAccident');
    window.location.href = createAccidentURL(data.accidentid, accident.title);
  }
}

function showArticleMenu(event, articlepostid) {
  event.preventDefault();
  event.stopPropagation();

  const div = document.getElementById(`menuArticle${articlepostid}`);
  const menuVisible = div.style.display === 'block';
  closeAllPopups();
  if (! menuVisible) div.style.display = 'block';
}

function showAccidentMenu(event, accidentID) {
  event.preventDefault();
  event.stopPropagation();

  const div = document.getElementById(`menuAccident${accidentID}`);
  const menuVisible = div.style.display === 'block';
  closeAllPopups();
  if (! menuVisible) div.style.display = 'block';
}

function getAccidentFromID(id){
  return accidents.find(accident => {return accident.id === id});
}

function getPersonFromID(id){
  return editAccidentPersons.find(person => {return person.id === id});
}

function getArticleFromID(id){
  return articles.find(article => article.id === id);
}

function getAccidentArticles(accidentID){
  let list = articles.filter(article => article.accidentid === accidentID);

  // Sort on publication time
  list.sort(function(a, b) {return b.publishedtime - a.publishedtime;});
  return list;
}

async function deleteArticleDirect(articleID) {
  const url = '/ajax.php?function=deleteArticle&id=' + articleID;
  try {
    const response = await fetch(url, fetchOptions);
    const text     = await response.text();
    const data     = JSON.parse(text);
    if (data.error) showError(data.error);
    else {
      // Remove article from articles array
      articles = articles.filter(a => a.id !== articleID);
      // Delete the GUI element
      document.getElementById('article' + articleID).remove();
      showMessage('Artikel verwijderd');
    }
  } catch (error) {
    showError(error.message);
  }
}

async function deleteAccidentDirect(accidentID) {
  const url = '/ajax.php?function=deleteAccident&id=' + accidentID;
  try {
    const response = await fetch(url, fetchOptions);
    const text = await response.text();
    const data = JSON.parse(text);
    if (data.error) showError(data.error);
    else {
      // Remove accident from accidents array
      accidents = accidents.filter(a => a.id !== accidentID);
      // Delete the GUI element
      document.getElementById('accident' + accidentID).remove();
      showMessage('Ongeluk verwijderd');
    }
  } catch (error) {
    showError(error.message);
  }
}

function reloadAccidents(){
  accidents = [];
  articles  = [];
  document.getElementById('cards').innerHTML = '';
  window.scrollTo(0, 0);
  loadAccidents();
}

function deleteArticle(id) {
  closeAllPopups();
  const article = getArticleFromID(id);

  confirmMessage(`Artikel "${article.title.substr(0, 100)}" verwijderen?`,
    function (){deleteArticleDirect(id)},
    'Verwijder artikel', null, true);
}

function deleteAccident(id) {
  closeAllPopups();
  const accident = getAccidentFromID(id);

  confirmMessage(`Ongeluk "${accident.title.substr(0, 100)}" verwijderen?`,
    function (){deleteAccidentDirect(id)},
    'Verwijder ongeluk', null, true);
}

function showMainSpinner(){
  document.getElementById('mainSpinner').style.display = 'inline-block';
}

function hideMainSpinner() {
  document.getElementById('mainSpinner').style.display = 'none';
}

function changeAccidentInvolved(item, event) {
  item.classList.toggle('buttonSelected');
}

function accidentByID(id) {
  return accidents.find(a => a.id === id);
}

function showAccidentDetails(id){
  const accident = accidentByID(id);
  window.location.href = createAccidentURL(accident.id, accident.title);
}

function showSearchField() {
  const div = document.getElementById('searchText');

  if (div.style.display !== 'inline-block') {
    div.style.display = 'inline-block';
    div.focus();
  }
}

function startSearch(event) {
  if (event.key === 'Enter') {
    const searchText = document.getElementById('searchText').value.trim().toLowerCase()
    const url = window.location.origin + '?search=' + encodeURIComponent(searchText);
    window.history.pushState(null, null, url);
    reloadAccidents();
  }
}
