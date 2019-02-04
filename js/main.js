let crashes = [];
let crashesFound = [];
let articles = [];
let articlesFound = [];
let editCrashPersons = [];
let watchEndOfPage = false;
let spinnerLoadCard;
let pageType;
let TpageType = Object.freeze({
  stream:                        0,
  crash:                         1,
  moderations:                   2,
  statisticsTransportationModes: 3,
  statisticsGeneral:             4,
  statisticsCrashPartners:       5,
  recent:                        6,
  deCorrespondent:               7,
  mosaic:                        8,
  export:                        9,
});

function initMain() {
  initPage();

  spinnerLoadCard = document.getElementById('spinnerLoad');

  const url              = new URL(location.href);
  const crashID          = getCrashNumberFromPath(url.pathname);
  const articleID        = url.searchParams.get('articleid');
  const searchText       = url.searchParams.get('search');
  const searchSiteName   = url.searchParams.get('sitename');
  const searchHealthDead = url.searchParams.get('hd');
  const pathName         = decodeURIComponent(url.pathname);

  if      (pathName.startsWith('/moderaties'))                 pageType = TpageType.moderations;
  else if (pathName.startsWith('/stream'))                     pageType = TpageType.stream;
  else if (pathName.startsWith('/decorrespondent'))            pageType = TpageType.deCorrespondent;
  else if (pathName.startsWith('/mozaiek'))                    pageType = TpageType.mosaic;
  else if (pathName.startsWith('/statistieken/algemeen'))      pageType = TpageType.statisticsGeneral;
  else if (pathName.startsWith('/statistieken/andere_partij')) pageType = TpageType.statisticsCrashPartners;
  else if (pathName.startsWith('/statistieken/vervoertypes'))  pageType = TpageType.statisticsTransportationModes;
  else if (pathName.startsWith('/statistieken'))               pageType = TpageType.statisticsGeneral;
  else if (pathName.startsWith('/exporteren'))                 pageType = TpageType.export;
  else if (crashID)                                            pageType = TpageType.crash;
  else                                                         pageType = TpageType.recent;

  let title = '';
  switch (pageType){
    case TpageType.stream:          title = 'Laatst gewijzigde ongelukken'; break;
    case TpageType.deCorrespondent: title = 'De Correspondent week<br>14 t/m 20 januari 2019'; break;
    case TpageType.moderations:     title = 'Moderaties'; break;
    case TpageType.recent:          title = 'Recente ongelukken'; break;
    default:                        title = '';
  }

  if (title) document.getElementById('pageSubTitle').innerHTML = title;

  if (searchText || searchSiteName || searchHealthDead) {
    document.body.classList.add('searchBody');
    document.getElementById('searchText').value     = searchText;
    document.getElementById('searchSiteName').value = searchSiteName;
    if (searchHealthDead) document.getElementById('searchPersonHealthDead').classList.add('buttonSelectedBlue');
  }

  addEditPersonButtons();

  if ((pageType === TpageType.statisticsTransportationModes) ||
      (pageType === TpageType.statisticsGeneral) ||
      (pageType === TpageType.statisticsCrashPartners)) {
    initStatistics();
    loadStatistics();
  } else if (pageType === TpageType.export){
    initPageUser();
    initExport();
  } else if (pageType === TpageType.crash){
    // Single crash details page
    loadCrashes(crashID, articleID);
  } else if ((pageType === TpageType.recent) ||
             (pageType === TpageType.stream) ||
             (pageType === TpageType.mosaic) ||
             (pageType === TpageType.deCorrespondent) ||
             (pageType === TpageType.crash)) {
    // Infinity scroll event
    // In the future switch to IntersectionObserver. At this moment Safari does not support it yet :(
    document.addEventListener("scroll", (event) => {
      if (watchEndOfPage) {
        if ((spinnerLoadCard.style.display==='block') && isScrolledIntoView(spinnerLoadCard)) {
          watchEndOfPage = false;
          loadCrashes();
        }
      }
    });

    if (pageType === TpageType.mosaic) document.getElementById('cards').classList.add('mosaic');
    loadCrashes();
  }
}

function initStatistics(){
  const url = new URL(location.href);
  if (pageType === TpageType.statisticsTransportationModes){
    const period = url.searchParams.get('period');
    if (period) document.getElementById('filterStatsPeriod').value = period;
  } else if (pageType === TpageType.statisticsCrashPartners){
    let html = '';
    for (const key of Object.keys(TTransportationMode)){
      const transportationMode =  TTransportationMode[key];
      const text               = transportationModeText(transportationMode);
      const selected           = transportationMode === TTransportationMode.bicycle? ' selected ' : '';
      html += `<option value="${transportationMode}" ${selected}>${text}</option>`;
    }

    document.getElementById('filterVictimTransportationMode').innerHTML = html;

    // set select
    let transportationMode = url.searchParams.get('transportationMode');
    if (transportationMode) document.getElementById('filterVictimTransportationMode').value = transportationMode;

    // Set transportation mode text
    transportationMode = parseInt(document.getElementById('filterVictimTransportationMode').value);
    document.getElementById('crashPartnerTransportationMode').innerText = transportationModeText(transportationMode);
  }
}

function initExport(){
  let html = '';
  for (const key of Object.keys(TTransportationMode)){
    const transportationMode =  TTransportationMode[key];
    const text               = transportationModeText(transportationMode);
    html += `<tr><td>${transportationMode}</td><td>${text}</td></tr>`;
  }
  document.getElementById('tbodyTransportationMode').innerHTML = html;

  html = '';
  for (const key of Object.keys(THealth)){
    const health = THealth[key];
    const text   = healthText(health);
    html += `<tr><td>${health}</td><td>${text}</td></tr>`;
  }
  document.getElementById('tbodyHealth').innerHTML = html;
}

async function loadStatistics(){

  function showStatisticsTransportation(dbStats) {
    let html = '';
    for (const stat of dbStats.total) {
      const icon = transportationModeIcon(stat.transportationmode, true);
      html += `<tr>
<td><div class="flexRow">${icon}<span class="hideOnMobile" style="margin-left: 5px;">${transportationModeText(stat.transportationmode)}</span></div></td>
<td style="text-align: right;">${stat.dead}</td>
<td style="text-align: right;">${stat.injured}</td>
<td style="text-align: right;">${stat.unharmed}</td>
<td style="text-align: right;">${stat.healthunknown}</td>
<td style="text-align: right;">${stat.child}</td>
<td style="text-align: right;">${stat.underinfluence}</td>
<td style="text-align: right;">${stat.hitrun}</td>
</tr>`;
    }
    document.getElementById('tableStatsBody').innerHTML = html;
    tippy('#tableStatsBody [data-tippy-content]');
  }

  function showStatisticsGeneral(dbStats) {
    document.getElementById('statisticsGeneral').innerHTML = `
    <div class="tableHeader">De Correspondent week (14 t/m 20 januari 2019)</div>
    <table id="tableStats" class="dataTable">
      <tbody>
        <tr>
          <td>Ongelukken</td>
          <td style="text-align: right;">${dbStats.deCorrespondent.crashes}</td>
        </tr>
        <tr>
          <td>Artikelen</td>
          <td style="text-align: right;">${dbStats.deCorrespondent.articles}</td>
        </tr>
        <tr>
          <td>Doden</td>
          <td style="text-align: right;">${dbStats.deCorrespondent.dead}</td>
        </tr>
        <tr>
          <td>Gewond</td>
          <td style="text-align: right;">${dbStats.deCorrespondent.injured}</td>
        </tr>
        <tr>
          <td>Toegevoegde ongelukken</td>
          <td style="text-align: right;">${dbStats.deCorrespondent.crashesAdded}</td>
        </tr>
        <tr>
          <td>Toegevoegde artikelen</td>
          <td style="text-align: right;">${dbStats.deCorrespondent.articlesAdded}</td>
        </tr>
        <tr>
          <td>Mensen die zich aangemeld hebben op deze site</td>
          <td style="text-align: right;">${dbStats.deCorrespondent.users}</td>
        </tr>
      </tbody>
    </table>  

    <div class="tableHeader">Vandaag</div>
    <table id="tableStats" class="dataTable">
      <tbody>
        <tr>
          <td>Ongelukken</td>
          <td style="text-align: right;">${dbStats.today.crashes}</td>
        </tr>
        <tr>
          <td>Artikelen</td>
          <td style="text-align: right;">${dbStats.today.articles}</td>
        </tr>
        <tr>
          <td>Doden</td>
          <td style="text-align: right;">${dbStats.today.dead}</td>
        </tr>
        <tr>
          <td>Gewond</td>
          <td style="text-align: right;">${dbStats.today.injured}</td>
        </tr>        
        <tr>
          <td>Toegevoegde Ongelukken</td>
          <td style="text-align: right;">${dbStats.today.crashesAdded}</td>
        </tr>
        <tr>
          <td>Toegevoegde Artikelen</td>
          <td style="text-align: right;">${dbStats.today.articlesAdded}</td>
        </tr>
      </tbody>
    </table>  

    <div class="tableHeader">7 dagen</div>
    <table id="tableStats" class="dataTable">
      <tbody>
        <tr>
          <td>Ongelukken</td>
          <td style="text-align: right;">${dbStats.sevenDays.crashes}</td>
        </tr>
        <tr>
          <td>Artikelen</td>
          <td style="text-align: right;">${dbStats.sevenDays.articles}</td>
        </tr>
        <tr>
          <td>Doden</td>
          <td style="text-align: right;">${dbStats.sevenDays.dead}</td>
        </tr>
        <tr>
          <td>Gewond</td>
          <td style="text-align: right;">${dbStats.sevenDays.injured}</td>
        </tr>        
        <tr>
          <td>Toegevoegde Ongelukken</td>
          <td style="text-align: right;">${dbStats.sevenDays.crashesAdded}</td>
        </tr>
        <tr>
          <td>Toegevoegde Artikelen</td>
          <td style="text-align: right;">${dbStats.sevenDays.articlesAdded}</td>
        </tr>
      </tbody>
    </table>  

    <div class="tableHeader">Totaal in database</div>
    <table id="tableStats" class="dataTable">
      <tbody>
        <tr>
          <td>Ongelukken</td>
          <td style="text-align: right;">${dbStats.total.crashes}</td>
        </tr>
        <tr>
          <td>Artikelen</td>
          <td style="text-align: right;">${dbStats.total.articles}</td>
        </tr>
        <tr>
          <td>Doden</td>
          <td style="text-align: right;">${dbStats.total.dead}</td>
        </tr>
        <tr>
          <td>Gewond</td>
          <td style="text-align: right;">${dbStats.total.injured}</td>
        </tr>                
        <tr>
          <td>Mensen die zich aangemeld hebben op deze site</td>
          <td style="text-align: right;">${dbStats.total.users}</td>
        </tr>
      </tbody>
    </table>
`;
  }

  function showStatisticsCrashPartners(dbStats, victimTransportationMode) {

    let total = 0;
    dbStats.crashPartners.forEach(partner => total += partner.deathCount);

    let html = '';
    for (const crashPartner of dbStats.crashPartners){
      const iconMode   = crashPartner.transportationMode === -1? victimTransportationMode : crashPartner.transportationMode;
      const icon       = transportationModeIcon(iconMode, true);
      const tmText     = crashPartner.transportationMode === -1? 'Eenzijdig ongeluk' : transportationModeText(crashPartner.transportationMode);
      const percentage = 100 * crashPartner.deathCount / total;
      html += `<tr>
<td><div class="flexRow">${icon}<span style="margin-left: 5px;">${tmText}</span></div></td>
<td style="text-align: right;">${crashPartner.deathCount}</td>
<td style="text-align: right;">${percentage.toFixed(1)}%</td>
</tr>`;
    }
    document.getElementById('tableStatsBody').innerHTML = html;
    tippy('#tableStatsBody [data-tippy-content]');
  }

  try {
    spinnerLoadCard.style.display = 'block';

    let url      = '/ajax.php?function=getStatistics';
    if      (pageType === TpageType.statisticsTransportationModes) url += '&period=' + document.getElementById('filterStatsPeriod').value;
    else if (pageType === TpageType.statisticsGeneral)            url += '&type=general';
    else if (pageType === TpageType.statisticsCrashPartners)      url += '&type=crashPartners&transportationMode='  + document.getElementById('filterVictimTransportationMode').value;

    const response = await fetch(url, fetchOptions);
    const text     = await response.text();
    data           = JSON.parse(text);
    if (data.user) updateLoginGUI(data.user);
    if (data.error) showError(data.error);
    else {
      if      (pageType === TpageType.statisticsGeneral) showStatisticsGeneral(data.statistics);
      else if (pageType === TpageType.statisticsCrashPartners) {
        const victimTransportationMode = parseInt(document.getElementById('filterVictimTransportationMode').value);

        let url = window.location.origin + '/statistieken/andere_partij?transportationMode=' + document.getElementById('filterVictimTransportationMode').value;
        window.history.pushState(null, null, url);

        showStatisticsCrashPartners(data.statistics, victimTransportationMode);
      }
      else {
        let url = window.location.origin + '/statistieken/vervoertypes?period=' + document.getElementById('filterStatsPeriod').value;
        window.history.pushState(null, null, url);

        showStatisticsTransportation(data.statistics);
      }
    }
  } catch (error) {
    showError(error.message);
  } finally {
    spinnerLoadCard.style.display = 'none';
  }
}

function statsCrashPartnersTransportationModeChange(){
  const transportationMode = parseInt(document.getElementById('filterVictimTransportationMode').value);
  document.getElementById('crashPartnerTransportationMode').innerText = transportationModeText(transportationMode);
  loadStatistics();
}

async function loadCrashes(crashID=null, articleID=null){
  function showCrashes(crashes){
    let html = '';
    if (crashes.length === 0) {
      let text = '';
      if (pageType === TpageType.moderations) text = 'Geen moderaties gevonden';
      else text = 'Geen ongelukken gevonden';

      html = `<div style="text-align: center;">${text}</div>`;
    } else if (pageType === TpageType.mosaic) {
      for (let crash of crashes) {
        const crashArticles = getCrashArticles(crash.id, articles);
        for (let article of crashArticles) {
          html +=`<div><img src="${article.urlimage}" onerror="this.style.visibility='hidden';"></div>`;
        }
      }
    } else {
      for (let crash of crashes) html += getCrashHTML(crash.id);
    }

    document.getElementById('cards').innerHTML += html;
    tippy('[data-tippy-content]');
  }

  let data;
  let maxLoadCount = (pageType === TpageType.mosaic)? 60 : 20;
  try {
    spinnerLoadCard.style.display = 'block';
    const searchText       = searchVisible()? document.getElementById('searchText').value.trim().toLowerCase() : '';
    const searchSiteName   = searchVisible()? document.getElementById('searchSiteName').value.trim().toLowerCase() : '';
    const searchHealthDead = searchVisible()? document.getElementById('searchPersonHealthDead').classList.contains('buttonSelectedBlue') : '';

    let url = '/ajax.php?function=loadCrashes&count=' + maxLoadCount + '&offset=' + crashes.length;
    if (crashID)                                url += '&id=' + crashID;
    if (searchText)                             url += '&search=' + encodeURIComponent(searchText);
    if (searchSiteName)                         url += '&sitename=' + encodeURIComponent(searchSiteName);
    if (searchHealthDead)                       url += '&healthdead=1';
    if (pageType === TpageType.moderations)     url += '&moderations=1';
    if ((pageType === TpageType.recent) || (pageType === TpageType.mosaic)) url += '&sort=crashDate';
    if (pageType === TpageType.deCorrespondent) url += '&sort=crashDate&searchDateFrom=2019-01-14&searchDateTo=2019-01-20';
    if (pageType === TpageType.mosaic)          url += '&imageUrlsOnly=1';

    const response = await fetch(url, fetchOptions);
    const text     = await response.text();
    data           = JSON.parse(text);
    if (data.user) updateLoginGUI(data.user);
    if (data.error) showError(data.error);
    else {
      prepareCrashServerData(data);

      crashes  = crashes.concat(data.crashes);
      articles = articles.concat(data.articles);
    }
  } catch (error) {
    showError(error.message);
  } finally {
    // Hide spinner if all data is loaded
    if (data.crashes.length < maxLoadCount) spinnerLoadCard.style.display = 'none';
  }

  if (crashID && (crashes.length === 1)) document.title = crashes[0].title + ' | Het Ongeluk';

  showCrashes(data.crashes);
  highlightSearchText();

  setTimeout(()=>{
    if (articleID) selectArticle(articleID);
    watchEndOfPage = true;
  }, 1);
}

function prepareArticleServerData(article){
  article.publishedtime  = new Date(article.publishedtime);
  article.createtime     = new Date(article.createtime);
  article.streamdatetime = new Date(article.streamdatetime);
}

function prepareCrashServerData(data){
  data.crashes.forEach(crash => {
    crash.date           = new Date(crash.date);
    crash.createtime     = new Date(crash.createtime);
    crash.streamdatetime = new Date(crash.streamdatetime);

    let id = 1;
    crash.persons.forEach(person => person.id = id++);
  });

  data.articles.forEach(article => prepareArticleServerData(article));
}

function getCrashGUIButtons(crash){
  let buttons = [];
  crash.persons.forEach(person => {
    // In the GUI buttons are used to visualise each person or group of persons.
    // We group persons who are in the same transportation item (eg 4 persons in a car).
    let button;
    if (person.groupid) {
      // All persons in same group are added to 1 button/icon in the GUI
      button = buttons.find(button => button.groupid === person.groupid);
      // Create new button if it does not yet exist
      if (! button) {
        button = {groupid: person.groupid, persons: []};
        buttons.push(button);
      }
    } else {
      // Persons without group always get their own GUI button/icon
      button = {groupid: null, persons: []};
      buttons.push(button);
    }
    button.persons.push(person);
  });
  return buttons;
}

function getCrashHTML(crashID){
  const crash         = getCrashFromID(crashID);
  const crashArticles = getCrashArticles(crash.id, articles);
  const canEditCrash  = user.moderator || (crash.userid === user.id);

  let htmlArticles = '';
  for (let article of crashArticles) {
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

    let htmlButtonAllText = '';
    if (user.moderator && article.hasalltext) htmlButtonAllText = `<span class="buttonSelectionSmall bgArticle" data-userid="${article.userid}" data-tippy-content="Toon alle tekst" onclick="toggleAllText(this, event, ${article.id});"></span>`;

    htmlArticles +=`
<div class="cardArticle" id="article${article.id}" onclick="closeAllPopups(); event.stopPropagation();">
  <a href="${article.url}" target="article">
    <div class="articleImageWrapper"><img class="articleImage" src="${article.urlimage}" onerror="this.style.display='none';"></div>
  </a>
  <div class="articleBody">
    <span class="postButtonArea" onclick="event.stopPropagation();">
      <span style="position: relative;">
        ${htmlButtonAllText}
        <span class="buttonEditPost buttonDetails" data-userid="${article.userid}" onclick="showArticleMenu(event, ${article.id});"></span>
      </span>
      <div id="menuArticle${article.id}" class="buttonPopupMenu" onclick="event.preventDefault();">
        <div onclick="editArticle(${crash.id},  ${article.id});">Bewerken</div>
        <div onclick="deleteArticle(${article.id})">Verwijderen</div>
      </div>            
    </span>   
    
    ${htmlModeration}     
  
    <div class="smallFont articleTitleSmall">
      <a href="${article.url}" target="article"><span class="cardSitename">${escapeHtml(article.sitename)}</span></a> 
      | ${dateToAge(article.publishedtime)} | toegevoegd door ${article.user}
    </div>
  
    <div class="articleTitle">${escapeHtml(article.title)}</div>
    <div id="articleText${article.id}" class="postText">${escapeHtml(article.text)}</div>
  </div>
</div>`;
  }

  let htmlInvolved = '';
  if (crash.pet)         htmlInvolved += '<div class="iconSmall bgPet"  data-tippy-content="Dier(en)"></div>';
  if (crash.trafficjam)  htmlInvolved += '<div class="iconSmall bgTrafficJam"  data-tippy-content="File/Hinder"></div>';
  // if (crash.tree)        htmlInvolved += '<div class="iconSmall bgTree"  data-tippy-content="Boom/Paal"></div>';

  if (htmlInvolved){
    htmlInvolved = `
    <div data-info="preventFullBorder">
      <div class="cardIcons" onclick="event.stopPropagation();">
        <div class="flexRow" style="justify-content: flex-end">${htmlInvolved}</div>
      </div>
    </div>`;
  }

  let titleSmall    = 'aangemaakt door ' + crash.user;
  let titleModified = '';
  if (crash.streamtopuser) {
    switch (crash.streamtoptype) {
      case TStreamTopType.edited:       titleModified = ' | aangepast door '                + crash.streamtopuser; break;
      case TStreamTopType.articleAdded: titleModified = ' | nieuw artikel toegevoegd door ' + crash.streamtopuser; break;
      case TStreamTopType.placedOnTop:  titleModified = ' | omhoog geplaatst door '         + crash.streamtopuser; break;
    }
    if (titleModified) titleModified += ' ' + datetimeToAge(crash.streamdatetime);
  }

  // Created date is only added if no modified title
  if (titleModified) titleSmall += titleModified;
  else titleSmall += ' ' + datetimeToAge(crash.createtime);

  const htmlPersons = getCrashButtonsHTML(crash, false);

  let htmlModeration = '';
  if (crash.awaitingmoderation){
    let modHTML = '';
    if (user.moderator) modHTML = `
Lieve moderator, deze bijdrage van "${crash.user}" wacht op moderatie.
<div style="margin: 10px;">
  <button class="button" onclick="crashModerateOK(${crash.id})">Keur bijdrage goed</button>
  <button class="button buttonGray" onclick="deleteCrash(${crash.id})">Verwijder bijdrage</button>
</div>
`;
    else if (crash.userid === user.id) modHTML = 'Bedankt voor het toevoegen van onderstaand bericht. Je bijdrage wordt spoedig gemodereerd en is tot die tijd nog niet voor iedereen zichtbaar.';
    else modHTML = 'Deze bijdrage wordt spoedig gemodereerd en is tot die tijd nog niet zichtbaar op de voorpagina.';

    htmlModeration = `<div id="crashModeration${crash.id}" class="moderation" onclick="event.stopPropagation()">${modHTML}</div>`;
  }

  let htmlMenuEditItems = '';
  if (canEditCrash) {
    htmlMenuEditItems = `
      <div onclick="editCrash(${crash.id});">Bewerken</div>
      <div onclick="showMergeCrashForm(${crash.id});">Samenvoegen</div>
      <div onclick="deleteCrash(${crash.id});">Verwijderen</div>
`;
  }

  if (user.moderator) htmlMenuEditItems += `<div onclick="crashToTopStream(${crash.id});" data-moderator>Plaats bovenaan stream</div>`;

  return `
<div id="crash${crash.id}" class="cardCrash" onclick="showCrashDetails(${crash.id})">
  <span class="postButtonArea" onclick="event.stopPropagation();">
    <span style="position: relative;"><span class="buttonEditPost buttonDetails"  data-userid="${crash.userid}" onclick="showCrashMenu(event, ${crash.id});"></span></span>
    <div id="menuCrash${crash.id}" class="buttonPopupMenu" onclick="event.preventDefault();">
      <div onclick="addArticleToCrash(${crash.id});">Artikel toevoegen</div>
      ${htmlMenuEditItems}
    </div>            
  </span>        

  ${htmlModeration}
   
  <div class="cardTop">
    <div style="width: 100%;">
      <div class="smallFont cardTitleSmall">${dateToAge(crash.date)} | ${titleSmall}</div>
      <div class="cardTitle">${escapeHtml(crash.title)}</div>
      <div>${htmlPersons}</div>
    </div>
    ${htmlInvolved}
  </div>

  <div class="postText">${escapeHtml(crash.text)}</div>    
  
  ${htmlArticles}
</div>`;
}


function healthVisible(health){
  return [THealth.dead, THealth.injured].includes(health);
}

function getCrashButtonsHTML(crash, showAllHealth=true, allowClick=false) {
  function getGroupButtonHTML(button) {
    if (button.persons.length < 1) return '';
    const person1 = button.persons[0];
    const bgTransportation = transportationModeImage(person1.transportationmode);
    let tooltip            = transportationModeText(person1.transportationmode);
    let iconsGroup         = `<div class="iconMedium ${bgTransportation}" data-tippy-content="${tooltip}"></div>`;
    let htmlPersons        = '';

    for (const person of button.persons){
      let tooltip = 'Persoon ' + person.id +
        '<br>Letsel: ' + healthText(person.health);
      if (person.child)          tooltip += '<br>Kind';
      if (person.underinfluence) tooltip += '<br>Onder invloed';
      if (person.hitrun)         tooltip += '<br>Doorrijden/vluchten';

      const showHealth = showAllHealth || healthVisible(person.health);
      let htmlPerson = '';
      if (showHealth)            htmlPerson += `<div class="iconMedium ${healthImage(person.health)}"></div>`;
      if (person.child)          htmlPerson += '<div class="iconMedium bgChild"></div>';
      if (person.underinfluence) htmlPerson += '<div class="iconMedium bgAlcohol"></div>';
      if (person.hitrun)         htmlPerson += '<div class="iconMedium bgHitRun"></div>';

      if (htmlPerson) htmlPersons += `<div class="crashButtonSub" data-tippy-content="${tooltip}">${htmlPerson}</div>`;
    }

    const clickClass = allowClick? '' : 'defaultCursor';
    return `<div class="crashButton ${ clickClass}" onclick="event.stopPropagation();">
  ${iconsGroup}
  ${htmlPersons}
</div>`;
  }

  const buttons = getCrashGUIButtons(crash);
  let html = '';
  for (const button of buttons) html += getGroupButtonHTML(button);
  return html;
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

function selectCrash(crashID, smooth=false) {
  const div = document.getElementById('crash' + crashID);
  if (smooth){
    div.scrollIntoView({
      block:    'start',
      behavior: 'smooth',
      inline:   'nearest'});

  } else scrollIntoViewIfNeeded(div);
}

function showEditCrashForm(event) {
  if (! user.loggedin){
     showLoginForm();
     return;
  }

  document.getElementById('editHeader').innerText       = 'Nieuw artikel en ongeluk toevoegen';
  document.getElementById('buttonSaveArticle').value    = 'Opslaan';
  document.getElementById('crashIDHidden').value        = '';
  document.getElementById('articleIDHidden').value      = '';

  document.getElementById('editArticleUrl').value       = '';
  document.getElementById('editArticleTitle').value     = '';
  document.getElementById('editArticleText').value      = '';
  document.getElementById('editArticleAllText').value   = '';
  document.getElementById('editArticleUrlImage').value  = '';
  document.getElementById('editArticleSiteName').value  = '';
  document.getElementById('editArticleDate').value      = '';

  document.getElementById('editCrashTitle').value       = '';
  document.getElementById('editCrashText').value        = '';
  document.getElementById('editCrashDate').value        = '';

  document.getElementById('editCrashPet').classList.remove('buttonSelected');
  document.getElementById('editCrashTrafficJam').classList.remove('buttonSelected');
  document.getElementById('editCrashTree').classList.remove('buttonSelected');

  editCrashPersons = [];
  refreshCrashPersonsGUI(editCrashPersons);

  document.querySelectorAll('[data-hideedit]').forEach(d => {d.style.display = 'inline-block';});

  document.getElementById('editCrashSection').style.display = 'flex';
  document.getElementById('editArticleSection').style.display  = 'flex';

  document.getElementById('formEditCrash').style.display    = 'flex';

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
    htmlButtons += `<span id="editPersonTransportationMode${key}" class="menuButton ${bgClass}" data-tippy-content="${text}" onclick="selectPersonTransportationMode(${transportationMode}, true);"></span>`;
  }
  document.getElementById('personTransportationButtons').innerHTML = htmlButtons;

  htmlButtons = '';
  for (const key of Object.keys(THealth)){
    const health =  THealth[key];
    const bgClass = healthImage(health);
    const text    = healthText(health);
    htmlButtons += `<span id="editPersonHealth${key}" class="menuButton ${bgClass}" data-tippy-content="${text}" onclick="selectPersonHealth(${health}, true);"></span>`;
  }
  document.getElementById('personHealthButtons').innerHTML = htmlButtons;
}

function showEditPersonForm(personID=null) {
  closeAllPopups();
  const person = getPersonFromID(personID);

  document.getElementById('editPersonHeader').innerText       = person? 'Persoon bewerken' : 'Nieuw persoon toevoegen';
  document.getElementById('personIDHidden').value             = person? person.id : '';
  document.getElementById('buttonDeletePerson').style.display = person? 'inline-flex' : 'none';

  selectPersonTransportationMode(person? person.transportationmode : null);
  selectPersonHealth(person? person.health : null);

  setMenuButton('editPersonChild',person? person.child : false);
  setMenuButton('editPersonUnderInfluence',person? person.underinfluence : false);
  setMenuButton('editPersonHitRun',person? person.hitrun : false);

  document.getElementById('formEditPerson').style.display = 'flex';
}

function selectPersonTransportationMode(transportationMode, toggle=false){
  selectPersonHealth(null);
  for (const key of Object.keys(TTransportationMode)) {
    const buttonTransportationMode = TTransportationMode[key];
    const button = document.getElementById('editPersonTransportationMode' + key);
    if (buttonTransportationMode === transportationMode) {
      if (toggle === true) button.classList.toggle('buttonSelected');
      else button.classList.add('buttonSelected');
    }
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

function selectPersonHealth(health, toggle=false) {
  for (const key of Object.keys(THealth)) {
    const buttonHealth = THealth[key];
    const button = document.getElementById('editPersonHealth' + key);
    if (button){
      if (buttonHealth === health) {
        if (toggle === true) button.classList.toggle('buttonSelected');
        else button.classList.add('buttonSelected');
      }
      else button.classList.remove('buttonSelected');
    }
  }
}

function selectSearchPersonDead() {
  document.getElementById('searchPersonHealthDead').classList.toggle('buttonSelectedBlue');
}

function getSelectedPersonHealth(){
  for (const key of Object.keys(THealth)) {
    const buttonHealth = THealth[key];
    const button = document.getElementById('editPersonHealth' + key);
    if (button && button.classList.contains('buttonSelected')) return buttonHealth;
  }
  return null;
}

function closeEditPersonForm(){
  document.getElementById('formEditPerson').style.display = 'none';
}

function savePerson(stayOpen=false) {
  const selectedTransportationMode = getSelectedPersonTransportationMode();
  const selectedHealth             = getSelectedPersonHealth();
  if (selectedTransportationMode === null) {showError('Geen vervoertype geselecteerd', 3); return;}
  if (selectedHealth             === null) {showError('Geen letsel geselecteerd', 3); return;}

  const personID = parseInt(document.getElementById('personIDHidden').value);
  let person;

  function loadPersonFromGUI(person){
    person.transportationmode = selectedTransportationMode;
    person.health             = selectedHealth;
    person.child              = menuButtonSelected('editPersonChild');
    person.underinfluence     = menuButtonSelected('editPersonUnderInfluence');
    person.hitrun             = menuButtonSelected('editPersonHitRun');
  }

  if (personID){
    person = getPersonFromID(personID);
    loadPersonFromGUI(person);
  } else {
    person = {id: editCrashPersons.length + 1};
    loadPersonFromGUI(person);

    editCrashPersons.push(person);
  }

  refreshCrashPersonsGUI(editCrashPersons);

  if (stayOpen !== true) closeEditPersonForm();
  else showMessage('Persoon opgeslagen', 0.5);
}

function deletePerson() {
  confirmMessage('Persoon verwijderen?',
    function () {
      const personID      = parseInt(document.getElementById('personIDHidden').value);
      editCrashPersons = editCrashPersons.filter(person => person.id !== personID);
      refreshCrashPersonsGUI(editCrashPersons);
      closeEditPersonForm();
    });
}

function refreshCrashPersonsGUI(persons=[]) {
  let html = '';

  for (let person of persons){
    const iconTransportation = transportationModeIcon(person.transportationmode);
    const iconHealth         = healthIcon(person.health);
    let buttonsOptions = '';
    if (person.child)          buttonsOptions += '<div class="iconSmall bgChild" data-tippy-content="Kind"></div>';
    if (person.underinfluence) buttonsOptions += '<div class="iconSmall bgAlcohol" data-tippy-content="Onder invloed"></div>';
    if (person.hitrun)         buttonsOptions += '<div class="iconSmall bgHitRun" data-tippy-content="Doorrijden/vluchten"></div>';

    html += `<div class="editCrashPerson" onclick="showEditPersonForm(${person.id});">
${iconHealth} ${iconTransportation} ${buttonsOptions}
</div>
`;
  }

  document.getElementById('editCrashPersons').innerHTML = html;
  tippy('[data-tippy-content]');
}

function setNewArticleCrashFields(crashID){
  const crash = getCrashFromID(crashID);
  const crashDatetime = new Date(crash.date);

  // Shallow copy
  editCrashPersons = clone(crash.persons);

  document.getElementById('crashIDHidden').value           = crash.id;

  document.getElementById('editCrashTitle').value          = crash.title;
  document.getElementById('editCrashText').value           = crash.text;
  document.getElementById('editCrashDate').value           = dateToISO(crashDatetime);

  selectButton('editCrashPet',         crash.pet);
  selectButton('editCrashTrafficJam',  crash.trafficjam);
  selectButton('editCrashTree',        crash.tree);

  refreshCrashPersonsGUI(crash.persons);
}

function openArticleLink(event, articleID) {
  event.stopPropagation();
  const article = getArticleFromID(articleID);
  window.open(article.url,"article");
}

function toggleAllText(element, event, articleId){
  event.preventDefault();
  event.stopPropagation();

  toggleSelectionButton(element);

  const article = getArticleFromID(articleId);
  const textElement = document.getElementById('articleText' + articleId);
  if (element.classList.contains('buttonSelected')) {
    textElement.innerHTML = '⌛';
    getArticleText(articleId).then(text => textElement.innerHTML = formatText(text));
  } else textElement.innerHTML = formatText(article.text);
}

function editArticle(crashID, articleID) {
  closeAllPopups();
  showEditCrashForm();
  setNewArticleCrashFields(crashID);

  const article = getArticleFromID(articleID);

  document.getElementById('editHeader').innerText           = 'Artikel bewerken';
  document.getElementById('buttonSaveArticle').value        = 'Opslaan';

  document.getElementById('articleIDHidden').value          = article? article.id : '';

  document.getElementById('editArticleUrl').value           = article.url;
  document.getElementById('editArticleTitle').value         = article.title;
  document.getElementById('editArticleText').value          = article.text;
  document.getElementById('editArticleAllText').readonly    = true;
  document.getElementById('editArticleAllText').value       = '⌛';

  document.getElementById('editArticleUrlImage').value      = article.urlimage;
  document.getElementById('editArticleSiteName').value      = article.sitename;
  document.getElementById('editArticleDate').value          = dateToISO(article.publishedtime);

  document.getElementById('formEditCrash').style.display    = 'flex';
  document.getElementById('editCrashSection').style.display = 'none';

  const text = getArticleText(articleID).then(
    text => {
      document.getElementById('editArticleAllText').value    = text;
      document.getElementById('editArticleAllText').readonly = false;
    }
  );
}

function addArticleToCrash(crashID) {
  closeAllPopups();

  showEditCrashForm();
  setNewArticleCrashFields(crashID);

  document.getElementById('editHeader').innerText              = 'Artikel toevoegen';
  document.getElementById('editCrashSection').style.display = 'none';
}

function editCrash(crashID) {
  closeAllPopups();

  showEditCrashForm();
  setNewArticleCrashFields(crashID);

  document.getElementById('editHeader').innerText                 = 'Ongeluk bewerken';
  document.getElementById('editArticleSection').style.display     = 'none';

  document.querySelectorAll('[data-hideedit]').forEach(d => {d.style.display = 'none';});
}

async function crashToTopStream(crashID) {
  closeAllPopups();

  const url = '/ajax.php?function=crashToStreamTop&id=' + crashID;
  const response = await fetch(url, fetchOptions);
  const text     = await response.text();
  const data     = JSON.parse(text);
  if (data.error) showError(data.error, 10);
  else window.location.reload();
}

async function getArticleText(articleId) {
  const url = '/ajax.php?function=getArticleText&id=' + articleId;
  const response = await fetch(url, fetchOptions);
  const text     = await response.text();
  const data     = JSON.parse(text);
  if (data.error) showError(data.error, 10);
  else return data.text;
}

async function crashModerateOK(crash) {
  closeAllPopups();

  const url = '/ajax.php?function=crashModerateOK&id=' + crash;
  const response = await fetch(url, fetchOptions);
  const text     = await response.text();
  const data     = JSON.parse(text);
  if (data.error) showError(data.error, 10);
  else if (data.ok){
    // Remove moderation div
    getCrashFromID(crash).awaitingmoderation = false;
    const divModeration = document.getElementById('crashModeration' + crash);
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

function copyCrashInfoFromArticle(){
  document.getElementById('editCrashTitle').value = document.getElementById('editArticleTitle').value;
}

function copyCrashDateFromArticle(){
  document.getElementById('editCrashDate').value  = document.getElementById('editArticleDate').value;
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

  const isNewArticle = document.getElementById('articleIDHidden').value === '';
  const url = '/ajax.php?function=getPageMetaData';
  const optionsFetch = {
    method: 'POST',
    body:   JSON.stringify({url: urlArticle, newArticle: isNewArticle}),
    headers:{'Content-Type': 'application/json'}
  };

  document.getElementById('spinnerMeta').style.display = 'flex';
  document.getElementById('tarantulaResults').innerHTML = '<img src="/images/spinner.svg" style="height: 30px;">';
  try {
    const response = await fetch(url, optionsFetch);
    const text     = await response.text();
    if (! text) showError('No response from server');
    const data     = JSON.parse(text);
    if (data.error) showError(data.error);
    else {
      if (data.urlExists) showMessage(`Bericht is al toegevoegd aan database.<br><a href='/${data.urlExists.crashId}' style='text-decoration: underline;'>Klik hier.</a>`, 30);
      else showMetaData(data.media);

      document.getElementById('tarantulaResults').innerHTML = `Gevonden:<br>
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

async function saveArticleCrash(){
  let crashEdited;
  let articleEdited;

  const saveArticle = document.getElementById('editArticleSection').style.display !== 'none';
  if (saveArticle){
    articleEdited = {
      id:       document.getElementById('articleIDHidden').value,
      url:      document.getElementById('editArticleUrl').value,
      sitename: document.getElementById('editArticleSiteName').value.trim(),
      title:    document.getElementById('editArticleTitle').value.trim(),
      text:     document.getElementById('editArticleText').value.trim(),
      urlimage: document.getElementById('editArticleUrlImage').value.trim(),
      date:     document.getElementById('editArticleDate').value,
      alltext:  document.getElementById('editArticleAllText').value.trim(),
    };
    if (articleEdited.id)  articleEdited.id  = parseInt(articleEdited.id);

    const domain = domainBlacklisted(articleEdited.url);
    if (domain) {
      showError(`Website ${domain.domain} kan niet worden toegevoegd. Reden: ${domain.reason}`);
      return
    }

    if (! articleEdited.url)                          {showError('Geen artikel link ingevuld'); return;}
    if (! articleEdited.title)                        {showError('Geen artikel titel ingevuld'); return;}
    if (! articleEdited.text)                         {showError('Geen artikel tekst ingevuld'); return;}
    if (articleEdited.urlimage.startsWith('http://')) {showError('Artikel foto link is onveilig. Begint met "http:". Probeer of de "https:" versie werkt. Laat anders dit veld leeg.'); return;}
    if (! articleEdited.sitename)                     {showError('Geen artikel mediabron ingevuld'); return;}
    if (! articleEdited.date)                         {showError('Geen artikel datum ingevuld'); return;}
  }

  crashEdited = {
    id:         document.getElementById('crashIDHidden').value,
    title:      document.getElementById('editCrashTitle').value,
    text:       document.getElementById('editCrashText').value,
    date:       document.getElementById('editCrashDate').value,
    persons:    editCrashPersons,
    pet:        document.getElementById('editCrashPet').classList.contains('buttonSelected'),
    trafficjam: document.getElementById('editCrashTrafficJam').classList.contains('buttonSelected'),
    tree:       document.getElementById('editCrashTree').classList.contains('buttonSelected'),
  };

  if (crashEdited.id) crashEdited.id = parseInt(crashEdited.id);

  const saveCrash = document.getElementById('editCrashSection').style.display !== 'none';
  if (saveCrash){
    if (saveArticle && (! user.moderator)) crashEdited.title = articleEdited.title;
    if (!crashEdited.title)               {showError('Geen ongeluk titel ingevuld'); return;}
    if (!crashEdited.date)                {showError('Geen ongeluk datum ingevuld'); return;}
    if (crashEdited.persons.length === 0) {showError('Geen personen toegevoegd'); return;}
  }

  const url = '/ajax.php?function=saveArticleCrash';
  const optionsFetch = {
    method:  'POST',
    body: JSON.stringify({
      article:      articleEdited,
      crash:        crashEdited,
      saveArticle:  saveArticle,
      saveCrash:    saveCrash,
    }),
    headers: {'Content-Type': 'application/json'},
  };
  const response = await fetch(url, optionsFetch);
  const text     = await response.text();
  const data     = JSON.parse(text);
  if (data.error) {
    showError(data.error, 10);
  } else {
    const editingCrash = crashEdited.id !== '';

    // No reload only if editing crash. Other cases for now give problems and require a full page reload.
    const isCrashPage = ((pageType === TpageType.crash) || (pageType === TpageType.recent) || (pageType === TpageType.deCorrespondent) || (pageType === TpageType.deCorrespondent));
    if (editingCrash && isCrashPage) {
      if (saveCrash){
        // Save changes in crashes cache
        let i = crashes.findIndex(crash => {return crash.id === crashEdited.id});
        crashes[i].title      = crashEdited.title;
        crashes[i].text       = crashEdited.text;
        crashes[i].persons    = crashEdited.persons;
        crashes[i].date       = new Date(crashEdited.date);
        crashes[i].pet        = crashEdited.pet;
        crashes[i].tree       = crashEdited.tree;
        crashes[i].trafficjam = crashEdited.trafficjam;
      } else if (saveArticle) {
        let i = articles.findIndex(article => {return article.id === articleEdited.id});
        if (i >= 0){
          articles[i].url        = articleEdited.url;
          articles[i].sitename   = articleEdited.sitename;
          articles[i].title      = articleEdited.title;
          articles[i].text       = articleEdited.text;
          articles[i].urlimage   = articleEdited.urlimage;
          articles[i].date       = articleEdited.date;
          articles[i].hasalltext = articleEdited.alltext.length > 0;
        } else if (data.article){
          prepareArticleServerData(data.article);
          articles.push(data.article);
        }
      }
      document.getElementById('crash' + crashEdited.id).outerHTML = getCrashHTML(crashEdited.id);
    } else {
      window.location.href = createCrashURL(data.crashId, crashEdited.title);
      let text = '';
      if (articleEdited) {
        text = articleEdited.id? 'Artikel opgeslagen' : 'Artikel toegevoegd';
      } else text = 'Ongeluk opgeslagen';
      showMessage(text, 1);
    }
    hideDiv('formEditCrash');
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

function showCrashMenu(event, crashID) {
  event.preventDefault();
  event.stopPropagation();

  const div = document.getElementById(`menuCrash${crashID}`);
  const menuVisible = div.style.display === 'block';
  closeAllPopups();
  if (! menuVisible) div.style.display = 'block';
}

function getCrashFromID(id){
  return crashes.find(crash => crash.id === id);
}

function getPersonFromID(id){
  return editCrashPersons.find(person => person.id === id);
}

function getArticleFromID(id){
  return articles.find(article => article.id === id);
}

function getCrashArticles(crashID, articles){
  let list = articles.filter(article => article.accidentid === crashID);

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

async function deleteCrashDirect(crashID) {
  const url = '/ajax.php?function=deleteCrash&id=' + crashID;
  try {
    const response = await fetch(url, fetchOptions);
    const text = await response.text();
    const data = JSON.parse(text);
    if (data.error) showError(data.error);
    else {
      // Remove crash from crashes array
      crashes = crashes.filter(crash => crash.id !== crashID);
      // Delete the GUI element
      document.getElementById('crash' + crashID).remove();
      showMessage('Ongeluk verwijderd');
    }
  } catch (error) {
    showError(error.message);
  }
}

function reloadCrashes(){
  crashes = [];
  articles  = [];
  document.getElementById('cards').innerHTML = '';
  window.scrollTo(0, 0);
  loadCrashes();
}

function deleteArticle(id) {
  closeAllPopups();
  const article = getArticleFromID(id);

  confirmMessage(`Artikel "${article.title.substr(0, 100)}" verwijderen?`,
    function (){deleteArticleDirect(id)},
    'Verwijder artikel', null, true);
}

function deleteCrash(id) {
  closeAllPopups();
  const crash = getCrashFromID(id);

  confirmMessage(`Ongeluk "${crash.title.substr(0, 100)}" verwijderen?`,
    function (){deleteCrashDirect(id)},
    'Verwijder ongeluk', null, true);
}

function crashRowHTML(crash, isSearch=false){

  function innerHTML(crash, allArticles) {
    const htmlPersons = getCrashButtonsHTML(crash, false);

    const crashArticles = getCrashArticles(crash.id, allArticles);
    const img = (crashArticles.length > 0)? `<img class="thumbnail" src="${crashArticles[0].urlimage}">` : '';
    return `
  <div class="flexRow" style="justify-content: space-between;">
    <div style="padding: 3px;">
      ${crash.title}
      <div class="smallFont">#${crash.id} ${crash.date.toLocaleDateString()}</div>
      <div>${htmlPersons}</div>
    </div>
    <div class="thumbnailWrapper">${img}</div>
  </div>`;
  }

  if (isSearch) {
    const html = innerHTML(crash, articlesFound);
    return `<div class="searchRow" onclick="mergeSearchResultClick(${crash.id})">${html}</div>`;
  } else return innerHTML(crash, articles);
}

function showMergeCrashForm(id) {
  closeAllPopups();
  const crash = getCrashFromID(id);

  document.getElementById('mergeFromCrashIDHidden').value     = crash.id;
  document.getElementById('mergeCrashSearch').value           = '';
  document.getElementById('mergeCrashSearchDay').value        = 0; // Same day
  document.getElementById('mergeToCrashIDHidden').value       = '';
  document.getElementById('mergeCrashTo').innerHTML           = '';
  document.getElementById('mergeCrashTo').style.display       = 'none';
  document.getElementById('mergeSearchResults').innerHTML     = '';
  document.getElementById('mergeSearchResults').style.display = 'none';
  document.getElementById('mergeCrashFrom').innerHTML         = crashRowHTML(crash);
  document.getElementById('formMergeCrash').style.display     = 'flex';
}

function searchMergeCrashDelayed() {
  document.getElementById('spinnerMerge').style.display       = 'block';
  document.getElementById('mergeCrashTo').innerHTML           = '';
  document.getElementById('mergeCrashTo').style.display       = 'none';
  document.getElementById('mergeSearchResults').innerHTML     = '';
  document.getElementById('mergeSearchResults').style.display = 'none';
  document.getElementById('mergeToCrashIDHidden').value       = '';

  clearTimeout(searchMergeCrashDelayed.timeout);
  searchMergeCrashDelayed.timeout = setTimeout(searchMergeCrash,500);
}

async function searchMergeCrash() {
  try {
    const searchText = document.getElementById('mergeCrashSearch').value.trim().toLowerCase();
    if (searchText.length < 2) return;

    const crashID = parseInt(document.getElementById('mergeFromCrashIDHidden').value);
    const crash   = getCrashFromID(crashID);
    let url       = '/ajax.php?function=loadCrashes&count=10&search=' + encodeURIComponent(searchText);

    const dateSearch = document.getElementById('mergeCrashSearchDay').value;
    let dateFrom;
    let dateTo;
    if (dateSearch === '0'){
      dateFrom = crash.date;
      dateTo   = crash.date;
    } else if (isInt(dateSearch)) {
      dateFrom = crash.date.addDays(-dateSearch);
      dateTo   = crash.date.addDays(dateSearch);
    }

    if (dateFrom) url += '&searchDateFrom=' + dateToISO(dateFrom) + '&searchDateTo=' + dateToISO(dateTo);

    const response = await fetch(url, fetchOptions);
    const text     = await response.text();
    const data     = JSON.parse(text);
    if (data.error) showError(data.error);
    else if (data.ok){
      prepareCrashServerData(data);
      crashesFound  = data.crashes;
      articlesFound = data.articles;

      let html = '';
      crashesFound.forEach(crashFound => {if (crashFound.id !== crash.id) html += crashRowHTML(crashFound, true);});
      document.getElementById('mergeSearchResults').innerHTML     = html;
      document.getElementById('mergeSearchResults').style.display = 'block';
    }
  } finally {
    document.getElementById('spinnerMerge').style.display = 'none';
  }
}


function mergeSearchResultClick(crashID) {
  const crash = crashesFound.find(crash => crash.id === crashID);
  let html = '';
  let crashId = '';
  if (crash) {
    html  = crashRowHTML(crash);
    crashId = crash.id;
  }

  document.getElementById('mergeToCrashIDHidden').value   = crashId;
  document.getElementById('mergeCrashTo').innerHTML       = html;
  document.getElementById('mergeCrashTo').style.display   = 'block';
}

function mergeCrash() {
  const fromID = parseInt(document.getElementById('mergeFromCrashIDHidden').value);
  const toID   = parseInt(document.getElementById('mergeToCrashIDHidden').value);
  if (! toID) showError('Geen samenvoeg crash geselecteerd');

  const crashFrom = getCrashFromID(parseInt(fromID));
  const crashTo   = crashesFound.find(crash => crash.id === toID);

  async function mergeCrashesOnServer(fromID, toID){
    const url      = `/ajax.php?function=mergeCrashes&idFrom=${fromID}&idTo=${toID}`;
    const response = await fetch(url, fetchOptions);
    const text     = await response.text();
    const data     = JSON.parse(text);
    if (data.error) showError(data.error);
    else {
      articles.forEach(article => {if (article.accidentid === fromID) article.accidentid = toID;});
      crashes.filter(crash => crash.id !== fromID);

      // Update GUI
      // Delete from crash
      const fromElement = document.getElementById('crash' + fromID);
      if (fromElement) fromElement.remove();

      closePopupForm();

      // Update to crash
      const toElement = document.getElementById('crash' + toID);
      if (toElement) {
        toElement.outerHTML = getCrashHTML(toID);
        selectCrash(toID, true);
      }
    }
  }

  confirmMessage(`Ongeluk <br>#${crashFrom.id} ${crashFrom.title}<br><br>samenvoegen met<br>#${crashTo.id} ${crashTo.title}?`,
    function () {
      mergeCrashesOnServer(fromID, toID);
    }, 'Ja, voeg samen');
}


function showMainSpinner(){
  document.getElementById('mainSpinner').style.display = 'inline-block';
}

function hideMainSpinner() {
  document.getElementById('mainSpinner').style.display = 'none';
}

function crashByID(id) {
  return crashes.find(a => a.id === id);
}

function showCrashDetails(id){
  const crash = crashByID(id);
  window.location.href = createCrashURL(crash.id, crash.title);
}

function searchVisible(){
  return document.body.classList.contains('searchBody');
}

function toggleSearchBar() {
  document.body.classList.toggle('searchBody');
  if (searchVisible()) document.getElementById('searchText').focus();
}

function startSearchKey(event) {
  if (event.key === 'Enter') startSearch();
}

function startSearch() {
  const searchText       = document.getElementById('searchText').value.trim().toLowerCase()
  const searchSiteName   = document.getElementById('searchSiteName').value.trim().toLowerCase()
  const searchHealthDead = document.getElementById('searchPersonHealthDead').classList.contains('buttonSelectedBlue');

  let url = window.location.origin;
  if      (pageType === TpageType.deCorrespondent) url += '/decorrespondent';
  else if (pageType === TpageType.stream)          url += '/stream';
  url += '?search=' + encodeURIComponent(searchText);
  if (searchSiteName)   url += '&sitename=' + encodeURIComponent(searchSiteName);
  if (searchHealthDead) url += '&hd=1';
  window.history.pushState(null, null, url);
  reloadCrashes();
}

function downloadData() {

  function download(uri, filename) {
    var element = document.createElement('a');
    element.setAttribute('href', uri);
    element.setAttribute('download', filename);
    element.style.display = 'none';
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
  }

  async function doDownload(){
    const spinner = document.getElementById('spinnerLoad');
    spinner.style.display = 'block';
    try {
      let url          = '/beheer/exportdata.php?function=downloadData';
      const response   = await fetch(url, fetchOptions);
      const text       = await response.text();
      const data       = JSON.parse(text);

      url = '/beheer/' + data.filename;
      download(url, data.filename);
    } finally {
      spinner.style.display = 'none';
    }
  }

  confirmMessage('Data van alle ongelukken exporteren?', doDownload, 'Download');
}
