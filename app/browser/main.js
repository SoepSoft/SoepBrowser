window.onerror = function (message, source, lineno, colno, error) { //error alert
    alert('An error occurred you may restart the browser.' + '\n' + lineno + "," + colno + " " + error);
};

var win = nw.Window.get();

const { execFile } = require('child_process');
const { exec } = require('child_process');
const fs = require("fs");

const tabBar = document.getElementById("tabBar");
const page = document.getElementById("page");
const URLBar = document.getElementById("URLBar");

let tabs = [];
let currentTab = 1;
let bookmarks = [];
let tabsAreScrollbarHeight;

handleVersion();
setDefaultIfEmpty();
updateFeatures();

if (localStorage.getItem('featuresKioskmode') == 'false') {
	win.maximize();
}

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
		if (page.children.length !== 0) {
			page.children[currentTab-1].src = URLBar.value;
		}
		URLBar.blur();
	}
});

function updateTabs(option) {
	let barHeight;
	if (option == 'scrollbar') {
		barHeight = 30;
		tabsAreScrollbarHeight = true;
	} else {
		barHeight = 40;
		tabsAreScrollbarHeight = false;
	}

	tabBar.innerHTML = `<button class="newTabButton" style="height: ${barHeight + 10}px;" onclick="newTab();" title="New tab">+</button>`;
	for (let i = 1; i < tabs.length + 1; i++) {
		const tabData = tabs[i-1];

		const tab = document.createElement("div");
		tab.style.height = barHeight + "px";
		tab.classList.add("tab"); //add tab object to class (CSS data inside index)
		tabBar.appendChild(tab);

		const tabButton = document.createElement("button");
		tabButton.textContent = tabData.name;
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
	if (option!== 'scrollbar') {
		updateTabHeightForscrollbar();
	}
}

function updateTabHeightForscrollbar() { //make tabs smaller if scrollbar is visible
	if (tabBar.scrollWidth > tabBar.clientWidth) {
		if(!tabsAreScrollbarHeight) { //don't update if already 'ScrollbarHeight'
		updateTabs('scrollbar');
		}
	} else {
		if (tabsAreScrollbarHeight) { //if there is no scrollbar anymore make tabs full size again (if they aren't yet)
			updateTabs()
		}
	}
}

function newTab(overrideStartURL) {
	tabs.unshift({"name": "New tab","nameEdited": false}); //add New tab to beginning of tabs
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
		const tabData = tabs[Array.from(page.children).indexOf(webview)];
		if (!tabData.nameEdited) {
			try {
			let url = (new URL(webview.src));
			tabData.name = url.hostname.replace("www.", "");
			tabs[Array.from(page.children).indexOf(webview)] = tabData;
			updateTabs();
			updateWindowTitle()
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
						if (event.ctrlKey && event.key == '0') {
							document.body.style.zoom = '100%';
						}
					});
					console.log('Injected Soep Browser fixes.');
				`
			});
		});
	}
								//for a later release if i feel like it (insert above)
							// if (event.ctrlKey && event.key == '-') {
							// document.body.style.zoom = Number(document.body.style.zoom.split('%')[0]) - 10 + '%';
						// }
						// if (event.ctrlKey && event.key == '+') {
							// document.body.style.zoom = Number(document.body.style.zoom.split('%')[0]) + 10 + '%';
						// }
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
	updateWindowTitle()
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
	updateWindowTitle();

	page.removeChild(page.children[tab-1]);
	if (tabs.length == 0) {
		if (localStorage.getItem('featuresKioskmode') == 'false') {
			win.close();
		} else {
			URLBar.value = '';
		}
		return;
	} else {
		updateURLBar()
	}
	showWebview(currentTab);
}

function renameTab(tab) {
	const tabData = tabs[tab-1];
	const newName = prompt(`Rename tab "${tabData.name}" to:`);
	if (newName != null && newName != "") {
		tabData.name = newName;
		tabData.nameEdited = true;
		tabs[tab-1] = tabData;
		updateTabs();
	}
};

function showWebview(tab) {
	for (let i = 0; i < tabs.length; i++) {
		page.children[i].style.display = "none";
	};
	if (page.children.length !== 0){
		page.children[tab-1].style.display = "block";
	}
}

function updateURLBar() {
	URLBar.value = page.children[currentTab-1].src;
}

function settings(action) {
	if (action == "open") {
		if (localStorage.getItem('featuresKioskmode') == 'true') { //password for kiosk mode
			const enteredPassword = prompt('Enter password to open settings:');
			if (enteredPassword == null) {
				return;
			}
			if (enteredPassword !== localStorage.getItem('kioskPassword')) {
				alert('Entered password is incorrect.');
				return;
			}
		}

		document.getElementById('settingsDialog').style.display = 'flex';
		document.getElementById('settingsDialog').style.flexDirection = 'column';
		document.getElementById('popupBg').style.display = 'flex';
		settingsGet();

		document.getElementById('settingsStartPage').style.display = 'block'; //start at search engine settings
		document.getElementById('settingsAbout').style.display = 'none';
		document.getElementById('settingsFeatures').style.display = 'none';
	}
	if (action == "close-discard") {
		document.getElementById('settingsDialog').style.display = 'none';
		document.getElementById('popupBg').style.display = 'none';
	}
	if (action == "close-apply") {
		document.getElementById('settingsDialog').style.display = 'none';
		document.getElementById('popupBg').style.display = 'none';
		settingsApply();
	}
	if (action == "searchEngine") {
		document.getElementById('settingsStartPage').style.display = 'block';
		document.getElementById('settingsAbout').style.display = 'none';
		document.getElementById('settingsFeatures').style.display = 'none';
	}
		if (action == "features") {
		document.getElementById('settingsStartPage').style.display = 'none';
		document.getElementById('settingsAbout').style.display = 'none';
		document.getElementById('settingsFeatures').style.display = 'block';
	}
	if (action == "about") {
		document.getElementById('settingsStartPage').style.display = 'none';
		document.getElementById('settingsAbout').style.display = 'block';
		document.getElementById('settingsFeatures').style.display = 'none';
		document.getElementById('NWJSVer').innerHTML = 'NW.js version ' + process.versions.nw;
	}
}

function settingsApply() { //save settings to local storage
	if(document.getElementById("settingsStartPageRadioGoogle").checked) { //startPage
		localStorage.setItem("startURL", "https://www.google.com");
	}
	if(document.getElementById("settingsStartPageRadioBing").checked) {
		localStorage.setItem("startURL", "https://www.bing.com");
	}
	if(document.getElementById("settingsStartPageRadioYahoo").checked) {
		localStorage.setItem("startURL", "https://search.yahoo.com");
	}
	if(document.getElementById("settingsStartPageRadioDuckduckgo").checked) {
		if (document.getElementById("settingsStartPageCheckboxDuckduckgoNoAI").checked) {
			localStorage.setItem("startURL", "https://noai.duckduckgo.com/");
		} else {
			localStorage.setItem("startURL", "https://start.duckduckgo.com/");
		}
	}
	if (document.getElementById("settingsStartPageCheckboxDuckduckgoNoAI").checked) { //save checkbox state even when duckduck go is not selected for convenience
		localStorage.setItem("duckduckgoNoAIcheckbox", "true");
	} else {
		localStorage.removeItem("duckduckgoNoAIcheckbox");
	}
	if(document.getElementById("settingsStartPageRadioEcosia").checked) {
		localStorage.setItem("startURL", "https://www.ecosia.org");
	}
	if(document.getElementById("settingsStartPageRadioOther").checked) {
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
	localStorage.setItem("featuresStartwithsystem", document.getElementById("settingsFeaturesCheckboxStartwithsystem").checked);
	localStorage.setItem("featuresKioskmode", document.getElementById("settingsFeaturesCheckboxKioskmode").checked);
	localStorage.setItem("featuresWindowtitletotabname", document.getElementById("settingsFeaturesCheckboxWindowtitletotabname").checked); //currently can't think of a better name
	localStorage.setItem("featuresAllowpopups", document.getElementById("settingsFeaturesCheckboxAllowpopups").checked);
	localStorage.setItem("featuresInjectfeaturestopage", document.getElementById("settingsFeaturesCheckboxInjectfeaturestopage").checked);
	
	if (process.platform == 'win32') {
		const startupShortcutPath = process.env.APPDATA + '\\Microsoft\\Windows\\Start Menu\\Programs\\Startup\\SoepBrowser.lnk';
		if (localStorage.getItem('featuresStartwithsystem') == 'true' && !fs.existsSync(startupShortcutPath)) {
			execFile('powershell.exe', [`
				$ws = New-Object -ComObject WScript.Shell;
				$s = $ws.CreateShortcut('${startupShortcutPath}');
				$s.TargetPath = '${process.execPath}';
				$s.Save();
				`]);
		}
		if (localStorage.getItem('featuresStartwithsystem') == 'false' && fs.existsSync(startupShortcutPath)) {
			fs.unlinkSync(startupShortcutPath);
		}
	}

	if (newKioskPWD) {
		localStorage.setItem('kioskPassword', newKioskPWD);
	}

	updateWindowTitle();
	updateFeatures();
}

function settingsGet() { //get settings from local storage.
	if (process.platform !== 'win32') { //
		document.getElementById("settingsFeaturesCheckboxStartwithsystem").disabled = true;
		document.getElementById("settingsFeaturesCheckboxStartwithsystem").title = 'Currently not availble for this platform.';
		
		document.getElementById("settingsFeaturesCheckboxKioskmode").disabled = true;
		document.getElementById("settingsFeaturesCheckboxKioskmode").title = 'Currently not availble for this platform.';
	}
	if (localStorage.getItem('duckduckgoNoAIcheckbox') == 'true') {
		document.getElementById("settingsStartPageCheckboxDuckduckgoNoAI").checked = true;
	} else {
		document.getElementById("settingsStartPageCheckboxDuckduckgoNoAI").checked = false;
	}

	document.getElementById("settingsStartURLOtherInput").value = localStorage.getItem("customStartURL");
	if (localStorage.getItem("startURL") == "https://www.google.com") {
		document.getElementById("settingsStartPageRadioGoogle").checked = true;
	} else {
		if (localStorage.getItem("startURL") == "https://www.bing.com") {
			document.getElementById("settingsStartPageRadioBing").checked = true;
		} else {
			if (localStorage.getItem("startURL") == "https://search.yahoo.com") {
				document.getElementById("settingsStartPageRadioYahoo").checked = true;
			} else {
				if (localStorage.getItem("startURL") == "https://start.duckduckgo.com/" || localStorage.getItem("startURL") == "https://noai.duckduckgo.com/") {
					document.getElementById("settingsStartPageRadioDuckduckgo").checked = true;
				} else {
					if (localStorage.getItem("startURL") == "https://www.ecosia.org") {
						document.getElementById("settingsStartPageRadioEcosia").checked = true;
					} else {
						document.getElementById("settingsStartPageRadioOther").checked = true;
						localStorage.setItem('customStartURL', localStorage.getItem("startURL"));
						document.getElementById("settingsStartURLOtherInput").value = localStorage.getItem("startURL");
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
	if (localStorage.getItem('featuresStartwithsystem') == 'true') {
		document.getElementById("settingsFeaturesCheckboxStartwithsystem").checked = true;
	} else {
		document.getElementById("settingsFeaturesCheckboxStartwithsystem").checked = false; 
	}
	if (localStorage.getItem('featuresWindowtitletotabname') == 'true') {
		document.getElementById("settingsFeaturesCheckboxWindowtitletotabname").checked = true;
	} else {
		document.getElementById("settingsFeaturesCheckboxWindowtitletotabname").checked = false;
	}
	if (localStorage.getItem('featuresKioskmode') == 'true') {
		document.getElementById("settingsFeaturesCheckboxKioskmode").checked = true;
	} else {
		document.getElementById("settingsFeaturesCheckboxKioskmode").checked = false;
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
	if (localStorage.getItem("featuresStartwithsystem") == null) {
		localStorage.setItem("featuresStartwithsystem", "false");
	}
	if (localStorage.getItem("featuresWindowtitletotabname") == null) {
		localStorage.setItem("featuresWindowtitletotabname", "true");
	}
	if (localStorage.getItem("featuresKioskmode") == null) {
		localStorage.setItem("featuresKioskmode", "false");
	}
	if (localStorage.getItem("featuresAllowpopups") == null) {
		localStorage.setItem("featuresAllowpopups", "false");
	}
	if (localStorage.getItem("featuresInjectfeaturestopage") == null) {
		localStorage.setItem("featuresInjectfeaturestopage", "true");
	}
}

async function resetBrowser() {
	if (confirm("Are you sure? The browser will be reset and closed.")) {
		await chrome.downloads.erase({});
		settings('close-discard');
		document.getElementById('waitDownloadHistorySaveDatabase').style.display = 'flex'; //I know it looks bad but it took way to long to figure this out and i want this release to finally be out after lots of delays.
		document.getElementById('popupBg').style.display = 'flex';
		setTimeout(function() {
			localStorage.clear();
			nw.App.clearCache();
			win.close(true);
		}, 10000);

	}
}

//maybe later if anyone cares
//function SetDefaultBrowser() {

//	alert('Click on Soep Browser, then click "Set as default". Click "OK" to open Settings.');
//	exec('start ms-settings:defaultapps');
//}
let updateActiveDownloadsInterval; //To save the updateActiveDownloads interval id to stop updating downloads when menu is closed.
function downloads(action) {
	if (action == 'open') {
		document.getElementById('downloadsDialog').style.display = 'flex';
		document.getElementById('downloadsDialog').style.flexDirection = 'column';
		document.getElementById('popupBg').style.display = 'flex';
		updateActiveDownloads(); //so you don't have to wait for the next update
		updateActiveDownloadsInterval = setInterval(updateActiveDownloads, 1000);
		getDownloads();
	}
	if (action == 'close') {
		clearInterval(updateActiveDownloadsInterval);
		document.getElementById('downloadsDialog').style.display = 'none';
		document.getElementById('popupBg').style.display = 'none';
	}
}

async function checkIfDownloading() {  //Check if file is being downloaded and show in UI.
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
setInterval(checkIfDownloading, 1000); //Check if file is being downloaded every second.

async function getDownloads() { //Get downloads and show in downloads menu
	document.getElementById('downloadsList').innerHTML = '';
	document.getElementById('downloadingList').innerHTML = '';
	const downloads = await chrome.downloads.search({orderBy: ["-startTime"]});
	for (let I = 0; I < downloads.length; I++) {
		let downloadDisplay = document.createElement('div');
		downloadDisplay.classList.add('downloadDisplay');
		if (downloads[I].state == "complete") {
			let state = document.createElement('h2');
			state.style.margin = '0px';
			state.innerText = 'Complete';
			downloadDisplay.appendChild(state);

			let file = document.createElement('a')
			file.href = '#';
			file.onclick = () => { ShowFileIfExists(downloads[I].filename) };
			file.innerText = downloads[I].filename.split("\\").pop();
			file.title = 'Show file in file browser';
			downloadDisplay.appendChild(file);

			let finishDateTime = document.createElement('h3');
			finishDateTime.style.margin = '0px';
			finishDateTime.innerText = new Date(downloads[I].startTime).toLocaleString();
			downloadDisplay.appendChild(finishDateTime);

			let fileSize = document.createElement('h3');
			fileSize.style.margin = '0px';
			fileSize.innerText = (downloads[I].fileSize / 1048576).toFixed(10) + 'MB';
			downloadDisplay.appendChild(fileSize);

			document.getElementById('downloadsList').appendChild(downloadDisplay);
		}
		if (downloads[I].state == "in_progress") { //Just create in progress download boxes updateActiveDownloads() will do the rest.
			document.getElementById('downloadingList').appendChild(downloadDisplay);
		}
		if (downloads[I].state !== "in_progress" && downloads[I].state !== "complete") { //Check if download state is "interrupted" or other and show error
			if (downloads[I].error) {
				let state = document.createElement('h2');
				state.style.margin = '0px';
				state.innerText = 'Error';
				downloadDisplay.appendChild(state);

				let error = document.createElement('h3');
				error.style.margin = '0px';
				error.textContent = downloads[I].error;
				downloadDisplay.appendChild(error);

				let finishDateTime = document.createElement('h3');
				finishDateTime.style.margin = '0px';
				finishDateTime.innerText = new Date(downloads[I].startTime).toLocaleString();
				downloadDisplay.appendChild(finishDateTime);

				let fileURL = document.createElement('a');
				fileURL.style.margin = '0px';
				fileURL.href = '#';
				fileURL.onclick = () => { alert(downloads[I].finalUrl) };
				fileURL.textContent = downloads[I].finalUrl.split("/")[2];
				fileURL.title = 'Show full URL';
				downloadDisplay.appendChild(fileURL);

			} else { //Just in case, idk if this could happen
				let state = document.createElement('h2');
				state.style.margin = '0px';
				state.innerText = 'Unknown';
				downloadDisplay.appendChild(state);

				let finishDateTime = document.createElement('h3');
				finishDateTime.style.margin = '0px';
				finishDateTime.innerText = new Date(downloads[I].startTime).toLocaleString();
				downloadDisplay.appendChild(finishDateTime);

				let fileURL = document.createElement('a');
				fileURL.style.margin = '0px';
				fileURL.href = '#';
				fileURL.onclick = () => { alert(downloads[I].finalUrl) };
				fileURL.textContent = downloads[I].finalUrl.split("/")[2];
				fileURL.title = 'Show full URL';
				downloadDisplay.appendChild(fileURL);
			}
			document.getElementById('downloadsList').appendChild(downloadDisplay);
		}
	}
}

async function updateActiveDownloads() {
	const inProgressDownloads = await chrome.downloads.search({state: "in_progress", orderBy: ["-startTime"]});
	if (localStorage.getItem('featuresDownloadhistory') !== 'true' && inProgressDownloads.length == 0) { //If download history is disabled and all downlads are finished clear download history.
		await chrome.downloads.erase({});
		getDownloads();
	}
	if (document.getElementById('downloadingList').children.length !== inProgressDownloads.length) { //Check if the amount of active downloads are the same as shown if not reload downloads.
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
	if (localStorage.getItem('featuresKioskmode') == 'true') {
		alert('Cannot open file browser in kiosk mode.');
		return;
	}
	if (!fs.existsSync(filePath)) {
		alert('File does not exist, the file may have been moved or deleted: ' + filePath);
		return;
	}
	nw.Shell.showItemInFolder(filePath);
}

function clearDownloads () {
	chrome.downloads.erase({}); //Erase all downloads
	getDownloads(); //Update UI
	updateActiveDownloads(); //So you dont have to wait for the next update to see the active downloads
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
		localStorage.removeItem('previousSessionTabs');
		localStorage.removeItem('previousSessionWebviews');
	}
	if (localStorage.getItem('featuresBookmarks') == 'true') {
		document.getElementById('bookmarksButton').style.display = 'block';
	} else {
		document.getElementById('bookmarksButton').style.display = 'none';
	}
	if (localStorage.getItem('featuresRestorepreviousbookmarks') !== 'true') {
		localStorage.removeItem('previousSessionBookmarks');
	}
	if (localStorage.getItem('featuresKioskmode') == 'true') {
		win.enterKioskMode();
		exec('taskkill /f /im explorer.exe'); //Else explorer may show with messages or popups
	} else {
		if (win.isKioskMode) { //Check if the window is still in kiosk mode (if so the browser was in kiosk mode)
			win.leaveKioskMode();
			exec('explorer.exe');
			win.maximize();
		}
	}
	setTimeout(() => { //Makes it more reliable
		updatePageHeight();
	}, 20);
}

function updatePageHeight() {
	document.getElementById('page').style.height = innerHeight - document.getElementById('page').getBoundingClientRect().top + 2 + 'px';
}

win.on('resize', async function () {
	updatePageHeight();
	updateTabHeightForscrollbar();
});
win.on('maximize', async function () {
	updatePageHeight();
	updateTabHeightForscrollbar();
});
win.on('restore', async function () {
	updatePageHeight();
	updateTabHeightForscrollbar();
});

function toggleBookmarksMenu() {
	const bookmarksMenu = document.getElementById('bookmarksMenu'); //I didn't know it works without this, better add it anyway?
	if (bookmarksMenu.style.display == 'none') {
		updateBookmarks();
		bookmarksMenu.style.display = 'flex';
	} else {
		bookmarksMenu.style.display = 'none';
	}
}
function updateBookmarkMenuSize() {
	const bookmarksMenu = document.getElementById('bookmarksMenu'); //Maybe it isn't such a bad idea to do it like this.
	const createBookmarkButton = document.getElementById('createBookmarkButton');
	const totalItemHeight = parseFloat(getComputedStyle(createBookmarkButton).height) + parseFloat(getComputedStyle(createBookmarkButton).marginTop) * 2;
	bookmarksMenu.style.height = bookmarksMenu.children.length * totalItemHeight + 'px';
}

function createBookmark() {
	if (bookmarks.length < 10) {
		if (page.children.length == 0) {
			return;
		}
		const bookmarkName = prompt('Bookmark name:', tabs[currentTab-1].name);
		if (bookmarkName == null) { //Stop if cancel button is pressed
			return;
		}
		if (bookmarkName.length > 16) {
			alert('Bookmark name cannot be more than 16 characters.');
			return;
		}
		const bookmarkURL = prompt('Bookmark URL:', page.children[currentTab-1].src);
		if (bookmarkURL == null) { //Stop if cancel button is pressed
			return;
		}
		bookmarks.push({"name": bookmarkName, "URL": bookmarkURL});
		updateBookmarks();
	} else {
		alert('Cannot create more than 10 bookmarks.');
	}
	toggleBookmarksMenu();
}
 function updateBookmarks() {
	 bookmarksMenu.innerHTML = '<button id="createBookmarkButton" class="bookmark" onclick="createBookmark();">Create bookmark</button>';
	 for (let I = 0; bookmarks.length > I; I++) {
		let newBookmark = document.createElement('button');
		newBookmark.title = 'Right-click to remove';
		newBookmark.textContent = bookmarks[I].name;
		newBookmark.onclick = () => {if (tabs.length == 0) { newTab(bookmarks[I].URL); } else { page.children[currentTab-1].src = bookmarks[I].URL; }; toggleBookmarksMenu(); };
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
win.window.addEventListener("keydown", (event) => { //Put all the hotkeys here.
	if (event.altKey && !event.repeat) {
		if (!isNaN(event.key)) {
			if (Number(event.key) < bookmarks.length) {
				if (tabs.length == 0) {
					newTab(bookmarks[event.key].URL);
				} else {
					page.children[currentTab-1].src = bookmarks[event.key].URL;
				}
			}
		}
	}
});
let newKioskPWD;
function editKioskPassword() {
	let newPassword = prompt('Enter password to open settings from kiosk mode:');
	if (newPassword == null){
		return false;
	}
	if (newPassword == '') {
		alert('Password cannot be empty, operation canceled.');
		return false;
	}
	newKioskPWD = newPassword;
	return true;
}

function kioskmodeCheckboxCode() {
	if (document.getElementById('settingsFeaturesCheckboxKioskmode').checked && localStorage.getItem('kioskPassword') == null) {
		if (editKioskPassword() !== true) {
			document.getElementById('settingsFeaturesCheckboxKioskmode').checked = false;
		}
	}
};
function updateWindowTitle() { 
	if (localStorage.getItem('featuresWindowtitletotabname') == 'true' && tabs.length !== 0) {
		win.title = tabs[currentTab-1].name + ' - ' + nw.App.manifest.name;
	} else {
		win.title = nw.App.manifest.name;
	}
};

function handleVersion() {
	document.getElementById('settingsVersionText').textContent = 'Version ' + nw.App.manifest.version;
	if (localStorage.getItem('browserVer') == null && localStorage.getItem('startURL') == null) {
		localStorage.setItem('browserVer', nw.App.manifest.version);
	} else {
		if (localStorage.getItem('browserVer') !== nw.App.manifest.version) {
			if (confirm("Data from an older or newer version was detected. Do you want to reset the browser? If you don't, there may be issues.")) {
				resetBrowser();
			} else {
				localStorage.setItem('browserVer', nw.App.manifest.version); //So it won't ask again.
			}
		}
	}
};

win.on('close', async function () {
	if (localStorage.getItem('featuresKioskmode') == 'true') {
		return;
	}
	const inProgressDownloads = await chrome.downloads.search({state: "in_progress", orderBy: ["-startTime"]});
	if (inProgressDownloads.length !== 0) { //Warning if downloads are active because the default one doesn't work when window close is hooked.
		if (!confirm('Close this window? Downloads are still active.')) {
			return;
		}
	}
	if (localStorage.getItem('featuresDownloadhistory') !== 'true') { //Make sure download history is deleted before closing when download history is off.
		await chrome.downloads.erase({});
	}
	if (localStorage.getItem('featuresRestoreprevioussessiononstartup') == 'true') { //Save session if on, if off clear
		localStorage.setItem('previousSessionTabs', JSON.stringify(tabs));
		localStorage.setItem('previousSessionWebviews', page.innerHTML);
	} else {
		localStorage.removeItem('previousSessionTabs');
		localStorage.removeItem('previousSessionWebviews');
	}
	if (localStorage.getItem('featuresRestorepreviousbookmarks') =='true') {
		localStorage.setItem('previousSessionBookmarks', JSON.stringify(bookmarks));
	} else {
		localStorage.removeItem('previousSessionBookmarks');
	}
	this.close(true);
});
