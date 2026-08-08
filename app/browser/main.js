window.onerror = function (message, source, lineno, colno, error) { //error alert
    alert('An error occurred you may restart the browser' + '\n' + lineno + "," + colno + " " + error);
};

var win = nw.Window.get();
win.maximize();

const { exec } = require('child_process');
const fs = require("fs");

const tabBar = document.getElementById("tabBar");
const page = document.getElementById("page");
const URLBar = document.getElementById("URLBar");

let tabs = [];
let currentTab = 1;
let bookmarks = [];

setDefaultIfEmpty();
updateFeatures();

if (localStorage.getItem("featuresRestoreprevioussessiononstartup") == 'true') {
	if (localStorage.getItem('previousSessionTabs') == null || localStorage.getItem('previousSessionWebviews') == null) {
		alert('Failed to restore session.');
		newTab();
	} else {
		tabs = JSON.parse(localStorage.getItem('previousSessionTabs'));
		page.innerHTML = localStorage.getItem('previousSessionWebviews');
		updateTabs();
		for (let I = 0; I < page.children.length; I++) {
			addWebViewEventListeners(page.children[I]);
		};
		switchTab(1, true); //make sure tab and webview are in sync
	}
} else {
	newTab();
}

if (localStorage.getItem('featuresRestorepreviousbookmarks') == 'true') {
	if (localStorage.getItem('previousSessionBookmarks') !== null) {
		const previousSessionBookmarks = JSON.parse(localStorage.getItem('previousSessionBookmarks'));
		for (let I = 0; previousSessionBookmarks.length > I; I++) {
			bookmarks.push(previousSessionBookmarks[I]);
		}
	}
}

URLBar.addEventListener("keyup", function(event) { //handle enter key inside URL bar
	if (event.key == "Enter") {
		page.children[currentTab-1].src = URLBar.value;
		URLBar.blur();
	}
});

function updateTabs(option) {
	let barHeight;
	if (option == 'scrollbar') {
		barHeight = 30;
	} else {
		barHeight = 40;
	}

	tabBar.innerHTML = `<button class="newTabButton" style="height: ${barHeight + 10}px;" onclick="newTab();" title="New tab">+</button>`;
	for (let i = 1; i < tabs.length + 1; i++) {
		const tabData = JSON.parse(tabs[i-1]);

		const tab = document.createElement("div");
		tab.style.height = barHeight + "px";
		tab.classList.add("tab"); //add tab object to class (CSS data inside index)
		tabBar.appendChild(tab);

		const tabButton = document.createElement("button");
		tabButton.innerHTML = tabData.name;
		tabButton.onclick = () => switchTab(i);
		tabButton.style.height = barHeight + "px";
		tabButton.classList.add("tabButton");
		if (i == currentTab) { //tabbutton gets class 'tabButton' and 'active'/'inactive'
			tabButton.classList.add("active");
			tabButton.title = 'Rename tab';
		} else {
			tabButton.classList.add("inActive");
			tabButton.title = 'Switch tab';
		}
		tab.appendChild(tabButton);

		const closeButton = document.createElement("button");
		closeButton.title = 'Close tab';
		closeButton.innerHTML = "X";
		closeButton.onclick = () => closeTab(i);
		closeButton.style.height = barHeight + "px";
		closeButton.classList.add("closeButton");
		tab.appendChild(closeButton);
	}

	if (tabBar.scrollWidth > tabBar.clientWidth && option!== 'scrollbar') { //make tabs smaller if scrollbar is visible
		updateTabs('scrollbar');
	}
}

function newTab(overrideStartURL) {
	tabs.unshift('{"name": "New tab","nameEdited": false}'); //add New tab to beginning of tabs
	updateTabs();

	const webview = document.createElement("webview");
	if (overrideStartURL) {
		webview.src = overrideStartURL;
	} else {
		webview.src = localStorage.getItem("startURL");
	}
	webview.style.width = "100vw";
	webview.style.flex = "1";
	webview.style.marginTop = "5px"; //margin not padding lol
	webview.style.backgroundColor = "#ffffff";

	addWebViewEventListeners(webview);
	page.prepend(webview);
	
	switchTab("1" , true);
};

function addWebViewEventListeners(webview) {
	webview.addEventListener('permissionrequest', (e) => { //permissions
		if (e.permission == 'fullscreen') {
			e.request.allow();
			nw.Window.open('browser/dialogs/fullscreen.html?url=' + encodeURIComponent(e.origin), { //show fullscreen message
				frame: false,
				show_in_taskbar: false,
				always_on_top: true,
				resizable: false,
				transparent: true, //Hide white background before HTML is loaded.
				position: 'center',
				width: 700,
				height: 200
			});
		}
		if (e.permission == 'download') {
			if (localStorage.getItem("featuresDownload") == 'true') {
				e.request.allow();
			} else {
				e.request.deny();
			}
		}
	});
	webview.addEventListener('loadstop', () => { //tab naming
		const tabData = JSON.parse(tabs[Array.from(page.children).indexOf(webview)]);
		if (!tabData.nameEdited) {
			try {
			let url = (new URL(webview.src));
			tabData.name = url.hostname.replace("www.", "");
			tabs[Array.from(page.children).indexOf(webview)] = JSON.stringify(tabData);
			updateTabs();
			} catch(error) {}; //catch JS error for invalid URL
		}
		updateURLBar();
	});
	if (localStorage.getItem('featuresInjectfeaturestopage') == 'true') {
		webview.addEventListener('contentload', () => {
			webview.executeScript({
				code: `
					document.addEventListener('keydown', (event) => {
						if (document.fullscreen) {
							if (event.key == 'Escape' || event.key == 'F11') {
								document.exitFullscreen();
							}
						}
					});
					console.log('Injected Soep Browser featuers.');
				`
			});
		});
	}
	webview.addEventListener("newwindow", (e) => {
		if (e.windowOpenDisposition == 'new_foreground_tab' && localStorage.getItem('featuresAllowwebsitestocreatetabs') == 'true') {
			newTab(e.targetUrl);
		}
		if (e.windowOpenDisposition == 'new_popup' && localStorage.getItem('featuresAllowpopups') == 'true') {
			window.open(e.targetUrl, e.name, "height=" + e.initialHeight + ",width=" + e.initialWidth);
		}
	});
}

function switchTab(tab, noRename) {
	if (currentTab == tab && !noRename) {
		renameTab(tab);
	} else {
		currentTab = tab;
		updateTabs();
		updateURLBar();

		showWebview(tab);
	};
};

function closeTab(tab) {
	if (tab < currentTab) {
		currentTab--
	}
	if (tab == currentTab) {
		if (tab == tabs.length)
		currentTab--
		}
	tabs.splice(tab-1, 1);
	updateTabs();

	page.removeChild(page.children[tab-1]);
	if (tabs.length == 0) {
		win.close();
		return;
	}
	showWebview(currentTab);
}

function renameTab(tab) {
	const tabData = JSON.parse(tabs[tab-1]);
	const newName = prompt(`Rename tab "${tabData.name}" to:`);
	if (newName != null && newName != "") {
		tabData.name = newName;
		tabData.nameEdited = true;
		tabs[tab-1] = JSON.stringify(tabData);
		updateTabs();
	}
};

function showWebview(tab) {
	for (let i = 0; i < tabs.length; i++) {
		page.children[i].style.display = "none";
	};
	page.children[tab-1].style.display = "block";
}

function updateURLBar() {
	URLBar.value = page.children[currentTab-1].src;
}

function settings(action) {
	if (action == "open") {
		document.getElementById('settingsDialog').style.display = 'flex';
		document.getElementById('settingsDialog').style.flexDirection = 'column';
		document.getElementById('popupBg').style.display = 'flex';
		settingsGet();

		document.getElementById('settingsSearchEngine').style.display = 'block'; //start at search engine settings
		document.getElementById('settingsAbout').style.display = 'none';
		document.getElementById('settingsFeatures').style.display = 'none';
	}
	if (action == "close") {
		document.getElementById('settingsDialog').style.display = 'none';
		document.getElementById('popupBg').style.display = 'none';
		settingsApply();
	}
	if (action == "searchEngine") {
		document.getElementById('settingsSearchEngine').style.display = 'block';
		document.getElementById('settingsAbout').style.display = 'none';
		document.getElementById('settingsFeatures').style.display = 'none';
	}
		if (action == "features") {
		document.getElementById('settingsSearchEngine').style.display = 'none';
		document.getElementById('settingsAbout').style.display = 'none';
		document.getElementById('settingsFeatures').style.display = 'block';
	}
	if (action == "about") {
		document.getElementById('settingsSearchEngine').style.display = 'none';
		document.getElementById('settingsAbout').style.display = 'block';
		document.getElementById('settingsFeatures').style.display = 'none';
		document.getElementById('NWJSVer').innerHTML = 'NW.js version ' + process.versions.nw;
	}
}

function settingsApply() { //save settings to local storage
	if(document.getElementById("settingsStartURLRadio1").checked) { //startURL
		localStorage.setItem("startURL", "https://www.google.com");
	}
	if(document.getElementById("settingsStartURLRadio2").checked) {
		localStorage.setItem("startURL", "https://www.bing.com");
	}
	if(document.getElementById("settingsStartURLRadio3").checked) {
		localStorage.setItem("startURL", "https://search.yahoo.com");
	}
	if(document.getElementById("settingsStartURLRadio4").checked) {
		localStorage.setItem("startURL", "https://www.duckduckgo.com");
	}
	if(document.getElementById("settingsStartURLRadio5").checked) {
		localStorage.setItem("startURL", "https://www.ecosia.org");
	}
	if(document.getElementById("settingsStartURLRadio6").checked) {
		localStorage.setItem("startURL", document.getElementById("settingsStartURLOtherInput").value);
	}
	localStorage.setItem("customStartURL", document.getElementById("settingsStartURLOtherInput").value);  //always save value of the other textbox for easy switching.

	localStorage.setItem("featuresTabs", document.getElementById("settingsFeaturesCheckboxTabs").checked); //localStorage.setItem seems to convert boolean to string anyway
	localStorage.setItem("featuresAllowwebsitestocreatetabs", document.getElementById("settingsFeaturesCheckboxAllowwebsitestocreatetabs").checked);
	localStorage.setItem("featuresRestoreprevioussessiononstartup", document.getElementById("settingsFeaturesCheckboxRestoreprevioussessiononstartup").checked);
	localStorage.setItem("featuresDownload", document.getElementById("settingsFeaturesCheckboxDownload").checked);
	localStorage.setItem("featuresDownloadmanager", document.getElementById("settingsFeaturesCheckboxDownloadmanager").checked);
	localStorage.setItem("featuresDownloadhistory", document.getElementById("settingsFeaturesCheckboxDownloadhistory").checked);
	localStorage.setItem("featuresBookmarks", document.getElementById("settingsFeaturesCheckboxBookmarks").checked);
	localStorage.setItem("featuresRestorepreviousbookmarks", document.getElementById("settingsFeaturesCheckboxRestorepreviousbookmarks").checked);
	localStorage.setItem("featuresAllowpopups", document.getElementById("settingsFeaturesCheckboxAllowpopups").checked);
	localStorage.setItem("featuresInjectfeaturestopage", document.getElementById("settingsFeaturesCheckboxInjectfeaturestopage").checked);
	updateFeatures();
}

function settingsGet() { //get settings from local storage.
	document.getElementById("settingsStartURLOtherInput").value = localStorage.getItem("customStartURL");
	if (localStorage.getItem("startURL") == "https://www.google.com") {
		document.getElementById("settingsStartURLRadio1").checked = true;
	} else {
		if (localStorage.getItem("startURL") == "https://www.bing.com") {
			document.getElementById("settingsStartURLRadio2").checked = true;
		} else {
			if (localStorage.getItem("startURL") == "https://search.yahoo.com") {
				document.getElementById("settingsStartURLRadio3").checked = true;
			} else {
				if (localStorage.getItem("startURL") == "https://www.duckduckgo.com") {
					document.getElementById("settingsStartURLRadio4").checked = true;
				} else {
					if (localStorage.getItem("startURL") == "https://www.ecosia.org") {
						document.getElementById("settingsStartURLRadio5").checked = true;
					} else {
						document.getElementById("settingsStartURLRadio6").checked = true;
					}
				}
			}
		}
	}

	if (localStorage.getItem('featuresTabs') == 'true') {
		document.getElementById("settingsFeaturesCheckboxTabs").checked = true;
	} else {
		document.getElementById("settingsFeaturesCheckboxTabs").checked = false;
	}
	if (localStorage.getItem('featuresAllowwebsitestocreatetabs') == 'true') {
		document.getElementById("settingsFeaturesCheckboxAllowwebsitestocreatetabs").checked = true;
	} else {
		document.getElementById("settingsFeaturesCheckboxAllowwebsitestocreatetabs").checked = false;
	}
	if (localStorage.getItem('featuresRestoreprevioussessiononstartup') == 'true') {
		document.getElementById("settingsFeaturesCheckboxRestoreprevioussessiononstartup").checked = true;
	} else {
		document.getElementById("settingsFeaturesCheckboxRestoreprevioussessiononstartup").checked = false;
	}
	if (localStorage.getItem('featuresDownload') == 'true') {
		document.getElementById("settingsFeaturesCheckboxDownload").checked = true;
	} else {
		document.getElementById("settingsFeaturesCheckboxDownload").checked = false;
	}
	if (localStorage.getItem('featuresDownloadmanager') == 'true') {
		document.getElementById("settingsFeaturesCheckboxDownloadmanager").checked = true;
	} else {
		document.getElementById("settingsFeaturesCheckboxDownloadmanager").checked = false;
	}
	if (localStorage.getItem('featuresDownloadhistory') == 'true') {
		document.getElementById("settingsFeaturesCheckboxDownloadhistory").checked = true;
	} else {
		document.getElementById("settingsFeaturesCheckboxDownloadhistory").checked = false;
	}
	if (localStorage.getItem('featuresBookmarks') == 'true') {
		document.getElementById("settingsFeaturesCheckboxBookmarks").checked = true;
	} else {
		document.getElementById("settingsFeaturesCheckboxBookmarks").checked = false;
	}
	if (localStorage.getItem('featuresRestorepreviousbookmarks') == 'true') {
		document.getElementById("settingsFeaturesCheckboxRestorepreviousbookmarks").checked = true;
	} else {
		document.getElementById("settingsFeaturesCheckboxRestorepreviousbookmarks").checked = false;
	}
	if (localStorage.getItem('featuresAllowpopups') == 'true') {
		document.getElementById("settingsFeaturesCheckboxAllowpopups").checked = true;
	} else {
		document.getElementById("settingsFeaturesCheckboxAllowpopups").checked = false;
	}
	if (localStorage.getItem('featuresInjectfeaturestopage') == 'true') {
		document.getElementById("settingsFeaturesCheckboxInjectfeaturestopage").checked = true;
	} else {
		document.getElementById("settingsFeaturesCheckboxInjectfeaturestopage").checked = false;
	}
}

function setDefaultIfEmpty() { //if a setting hasn't been saved e.g. first time using the browser, set it to default
	if (localStorage.getItem("startURL") == null) {
		localStorage.setItem("startURL", "https://www.google.com");  //default search engine is google
	}

	if (localStorage.getItem("featuresTabs") == null) { //features
		localStorage.setItem("featuresTabs", "true");
	}
	if (localStorage.getItem("featuresAllowwebsitestocreatetabs") == null) {
		localStorage.setItem("featuresAllowwebsitestocreatetabs", "true");
	}
	if (localStorage.getItem("featuresRestoreprevioussessiononstartup") == null) {
		localStorage.setItem("featuresRestoreprevioussessiononstartup", "false");
	}
	if (localStorage.getItem("featuresDownload") == null) {
		localStorage.setItem("featuresDownload", "true");
	}
	if (localStorage.getItem("featuresDownloadmanager") == null) {
		localStorage.setItem("featuresDownloadmanager", "true");
	}
	if (localStorage.getItem("featuresDownloadhistory") == null) {
		localStorage.setItem("featuresDownloadhistory", "true");
	}
	if (localStorage.getItem("featuresBookmarks") == null) {
		localStorage.setItem("featuresBookmarks", "true");
	}
	if (localStorage.getItem("featuresRestorepreviousbookmarks") == null) {
		localStorage.setItem("featuresRestorepreviousbookmarks", "true");
	}
	if (localStorage.getItem("featuresAllowpopups") == null) {
		localStorage.setItem("featuresAllowpopups", "false");
	}
	if (localStorage.getItem("featuresInjectfeaturestopage") == null) {
		localStorage.setItem("featuresInjectfeaturestopage", "true");
	}
}

function resetBrowser() {
	if (confirm("Are you sure? All the settings will be reset and the browser will close.")) {
		localStorage.clear();
		window.nw.App.clearCache();
		window.close();
	}
}

//maybe later if anyone cares
//function SetDefaultBrowser() {

//	alert('Click on Soep Browser, then click "Set as default". Click "OK" to open Settings.');
//	exec('start ms-settings:defaultapps');
//}
let updateActiveDownloadsInterval; //to save the updateActiveDownloads interval id to stop updating downloads when menu is closed
function downloads(action) {
	if (action == 'open') {
		document.getElementById('downloadsDialog').style.display = 'flex';
		document.getElementById('downloadsDialog').style.flexDirection = 'column';
		document.getElementById('popupBg').style.display = 'flex';
		getDownloads();
		updateActiveDownloads(); //so you don't have to wait for the next update
		updateActiveDownloadsInterval = setInterval(updateActiveDownloads, 1000);
	}
	if (action == 'close') {
		clearInterval(updateActiveDownloadsInterval);
		document.getElementById('downloadsDialog').style.display = 'none';
		document.getElementById('popupBg').style.display = 'none';
	}
}

async function checkIfDownloading() {  //check if file is being downloaded and show in UI
	const downloads = await chrome.downloads.search({});
	let downloading = false;
	for (let I = 0; I < downloads.length; I++) {
		if (downloads[I].state == "in_progress") {
			downloading = true;
		}
	}
	if (downloading) {
		document.getElementById('downloadsButton').style.backgroundColor = '#00ff00';
	} else {
		document.getElementById('downloadsButton').style.backgroundColor = '';
	}
}
setInterval(checkIfDownloading, 1000); //check if file is being downloaded every second

async function getDownloads() { //get downloads and show in downloads menu
	document.getElementById('downloadsList').innerHTML = '';
	document.getElementById('downloadingList').innerHTML = '';
	const downloads = await chrome.downloads.search({orderBy: ["-startTime"]});
	for (let I = 0; I < downloads.length; I++) {
		let downloadDisplay = document.createElement('div');
		downloadDisplay.classList.add('downloadDisplay');
		if (downloads[I].state == "complete") {
			downloadDisplay.innerHTML = `<h2 style="margin: 0;">Complete</h2> <h3 style="margin: 0;"><a href="#" onclick="ShowFileIfExists('${downloads[I].filename.replace(/\\/g, "\\\\")}');">${downloads[I].filename.split("\\").pop()}</a></h3> <h3 style="margin: 0;">${(downloads[I].fileSize / 1048576).toFixed(10)} MB</h3>`;
			document.getElementById('downloadsList').appendChild(downloadDisplay);
		}
		if (downloads[I].state == "in_progress") { //just create in progress download boxes updateActiveDownloads() will do the rest
			document.getElementById('downloadingList').appendChild(downloadDisplay);
		}
		if (downloads[I].state !== "in_progress" && downloads[I].state !== "complete") { //check if download state is "interrupted" or other and show error
			if (downloads[I].error) {
				downloadDisplay.innerHTML = `<h2 style="margin: 0;">Error</h2> <h3 style="margin: 0;">${downloads[I].error}</h3> <h3 style="margin: 0;">${downloads[I].finalUrl.split("/").pop()}</h3>`;
			} else { //just in case idk if this could happen
				downloadDisplay.innerHTML = `<h2 style="margin: 0;">Unknown</h2> <h3 style="margin: 0;">${downloads[I].finalUrl.split("\\").pop()}</h3>`;
			}
			document.getElementById('downloadsList').appendChild(downloadDisplay);
		}
	}
}

async function updateActiveDownloads() {
	const inProgressDownloads = await chrome.downloads.search({state: "in_progress", orderBy: ["-startTime"]});
	if (document.getElementById('downloadingList').children.length !== inProgressDownloads.length) { //check if the amount of active downloads are the same if not reload downloads
		if (localStorage.getItem('featuresDownloadhistory') !== 'true' && inProgressDownloads.length == 0) { //if download history is disabled and all downlads are finished clear download history
			await chrome.downloads.erase({});
		}
		await getDownloads()
	}
	if (inProgressDownloads.length == 0) {
		document.getElementById('downloadingList').innerHTML = 'No active downloads.';
	}
	for (let I = 0; I < inProgressDownloads.length; I++) {
			document.getElementById('downloadingList').children[I].innerHTML = `<h2 style="margin: 0;">Downloading...</h2> <h3 style="margin: 0;">${Math.round((inProgressDownloads[I].bytesReceived / inProgressDownloads[I].fileSize) * 100)}%</h3> <h3 style="margin: 0;">${inProgressDownloads[I].filename.split("\\").pop()}</h3>`;
	}
}

function ShowFileIfExists(filePath) {
	if (fs.existsSync(filePath)) {
		nw.Shell.showItemInFolder(filePath);
	} else {
		alert('File does not exist, the file may have been moved or deleted: ' + filePath);
	}
}

function clearDownloads () {
	chrome.downloads.erase({}); //erase all downloads
	getDownloads(); //update UI
	updateActiveDownloads(); //so you dont have to wait for the next update to see the active downloads
}

function updateFeatures() {
	if (localStorage.getItem('featuresTabs') == 'true') {
		document.getElementById('tabBar').style.display = 'flex';
	} else {
		document.getElementById('tabBar').style.display = 'none';
	}
	if (localStorage.getItem('featuresDownloadmanager') == 'true') {
		document.getElementById('downloadsButton').style.display = 'block';
	} else {
		document.getElementById('downloadsButton').style.display = 'none';
	}
	if (localStorage.getItem('featuresDownloadhistory') !== 'true') { //better safe than sorry
		chrome.downloads.erase({});
	}
	if (localStorage.getItem('featuresRestoreprevioussessiononstartup') !== 'true') {
		localStorage.setItem('previousSessionTabs', '');
		localStorage.setItem('previousSessionWebviews', '');
	}
	if (localStorage.getItem('featuresBookmarks') == 'true') {
		document.getElementById('bookmarksButton').style.display = 'block';
	} else {
		document.getElementById('bookmarksButton').style.display = 'none';
	}
	if (localStorage.getItem('featuresRestorepreviousbookmarks') !== 'true') {
		localStorage.setItem('previousSessionBookmarks', '');
	}
	setTimeout(() => { //makes it more reliable
		updatePageHeight();
	}, 0);
}

function updatePageHeight() {
	document.getElementById('page').style.height = innerHeight - document.getElementById('page').getBoundingClientRect().top + 1 + 'px';
}

win.on('resize', async function () {
updatePageHeight();
});
win.on('maximize', async function () {
updatePageHeight();
});
win.on('restore', async function () { //un-maximize detection
updatePageHeight();
});

function toggleBookmarksMenu() {
	const bookmarksMenu = document.getElementById('bookmarksMenu'); // i didn't know it works without this, better add it anyway?
	if (bookmarksMenu.style.display == 'none') {
		updateBookmarks();
		bookmarksMenu.style.display = 'flex';
	} else {
		bookmarksMenu.style.display = 'none';
	}
}
function updateBookmarkMenuSize() {
	const bookmarksMenu = document.getElementById('bookmarksMenu'); //maybe it isn't such a bad idea to do it like this.
	const createBookmarkButton = document.getElementById('createBookmarkButton');
	const totalItemHeight = parseFloat(getComputedStyle(createBookmarkButton).height) + parseFloat(getComputedStyle(createBookmarkButton).marginTop) * 2;
	bookmarksMenu.style.height = bookmarksMenu.children.length * totalItemHeight + 'px';
}

function createBookmark() {
	if (bookmarks.length < 10) {
		const bookmarkName = prompt('Bookmark name:', JSON.parse(tabs[currentTab-1]).name);
		if (bookmarkName == null) { //stop if cancel button is pressed
			return;
		}
		if (bookmarkName.length > 16) {
			alert('Bookmark name cannot be more than 16 characters.');
			return;
		}
		const bookmarkURL = prompt('Bookmark URL:', page.children[currentTab-1].src);
		if (bookmarkURL == null) { //stop if cancel button is pressed
			return;
		}
		bookmarks.push(JSON.stringify({"name": bookmarkName, "URL": bookmarkURL}));
		updateBookmarks();
	} else {
		alert('Cannot create more than 10 bookmarks.');
	}
}
 function updateBookmarks() {
	 bookmarksMenu.innerHTML = '<button id="createBookmarkButton" class="bookmark" onclick="createBookmark();">Create bookmark</button>';
	 for (let I = 0; bookmarks.length > I; I++) {
		let newBookmark = document.createElement('button');
		newBookmark.title = 'Right-click to remove';
		newBookmark.innerHTML = JSON.parse(bookmarks[I]).name;
		newBookmark.onclick = () => {page.children[currentTab-1].src = JSON.parse(bookmarks[I]).URL; toggleBookmarksMenu();};
		newBookmark.classList.add('bookmark');
		newBookmark.oncontextmenu = (event) => {
			event.preventDefault();
				bookmarks.splice(I, 1);
				updateBookmarks();
		};
		bookmarksMenu.appendChild(newBookmark);
	 }
	 updateBookmarkMenuSize();
 }
win.window.addEventListener("keydown", (event) => { //hotkeys
	if (event.altKey && !event.repeat) {
		if (!isNaN(event.key)) {
			if (Number(event.key) < bookmarks.length) {
				page.children[currentTab-1].src = JSON.parse(bookmarks[event.key]).URL;
			}
		}
	}
});

win.on('close', async function () {
	const inProgressDownloads = await chrome.downloads.search({state: "in_progress", orderBy: ["-startTime"]});
	if (inProgressDownloads.length !== 0) { //warning if downloads are active because the default one doesn't work when window close is hooked
		if (!confirm('Close this window? Downloads are still active.')) {
			return;
		}
	}
	if (localStorage.getItem('featuresDownloadhistory') !== 'true') { //make sure download history is deleted before closing when download history is off
		await chrome.downloads.erase({});
	}
	if (localStorage.getItem('featuresRestoreprevioussessiononstartup') == 'true') { //save session if on, if off clear
		localStorage.setItem('previousSessionTabs', JSON.stringify(tabs));
		localStorage.setItem('previousSessionWebviews', page.innerHTML);
	} else {
		localStorage.setItem('previousSessionTabs', '');
		localStorage.setItem('previousSessionWebviews', '');
	}
	if (localStorage.getItem('featuresRestorepreviousbookmarks') =='true') {
		localStorage.setItem('previousSessionBookmarks', JSON.stringify(bookmarks));
	} else {
		localStorage.setItem('previousSessionBookmarks', '');
	}
	this.close(true);
});
