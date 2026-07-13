var win = nw.Window.get();
win.maximize();

const { exec } = require('child_process');

const tabBar = document.getElementById("tabBar");
const page = document.getElementById("page");
const URLBar = document.getElementById("URLBar");

let tabs = [];
let webviews = [];
let currentTab = 1;

setDefaultIfEmpty();
newTab();

URLBar.addEventListener("keyup", function(event) { //handle enter key inside URL bar
    if (event.key == "Enter") {
        webviews[currentTab-1].src = URLBar.value;
		URLBar.blur();
    }
});

function updateTabs(option) {
	if (tabs.length == 0) {
		window.close();
	}

	let barHeight;
	if (option == 'scrollbar') {
		barHeight = 30;
	} else {
		barHeight = 40;
	}

	tabBar.innerHTML = `<button class="newTabButton" style="height: ${barHeight + 10}px;" onclick="newTab();">+</button>`;
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
		} else {
			tabButton.classList.add("inActive");
		}
		tab.appendChild(tabButton);

		const closeButton = document.createElement("button");
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

function newTab() {
	tabs.unshift('{"name": "New tab","nameEdited": false}'); //add New tab to beginning of tabs
	updateTabs();

	const webview = document.createElement("webview");
	webview.src = localStorage.getItem("startURL");
	webview.style.width = "100vw";
	webview.style.height = "87.1vh";
	webview.style.paddingTop = "5px";

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
			e.request.allow();
		}
	});

	webview.addEventListener('loadstop', () => { //tab naming
	const tabData = JSON.parse(tabs[webviews.findIndex(w => w === webview)]);
	if (!tabData.nameEdited) {
		let url = (new URL(webview.src));
		tabData.name = url.hostname.replace("www.", "");
		tabs[webviews.findIndex(w => w === webview)] = JSON.stringify(tabData);
		updateTabs();
		updateURLBar();
	}
});

	page.appendChild(webview);
	
	webviews.unshift(webview); //add webview to beginning of webviews
	switchTab("1" , true);
};

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

	page.removeChild(webviews[tab-1]);
	webviews.splice(tab-1, 1);
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
		webviews[i].style.display = "none";
	};
	webviews[tab-1].style.display = "block";
}

function updateURLBar() {
	URLBar.value = webviews[currentTab-1].src;
}

function settings(action) {
	if (action == "open") {
		document.getElementById('settings').style.display = 'flex';
		document.getElementById('settings').style.flexDirection = 'column';
		document.getElementById('popupBg').style.display = 'flex';
		settingsGet();

		document.getElementById('settingsSearchEngine').style.display = 'block';
		document.getElementById('settingsPermissions').style.display = 'none';
		document.getElementById('settingsAbout').style.display = 'none';
	}
	if (action == "close") {
		document.getElementById('settings').style.display = 'none';
		document.getElementById('popupBg').style.display = 'none';
		settingsApply();
	}
	if (action == "searchEngine") {
		document.getElementById('settingsSearchEngine').style.display = 'block';
		document.getElementById('settingsPermissions').style.display = 'none';
		document.getElementById('settingsAbout').style.display = 'none';
	}
	if (action == "permissions") {	//currently unused
		document.getElementById('settingsPermissions').style.display = 'block';
		document.getElementById('settingsSearchEngine').style.display = 'none';
		document.getElementById('settingsAbout').style.display = 'none';
	}
	if (action == "about") {
		document.getElementById('settingsPermissions').style.display = 'none';
		document.getElementById('settingsSearchEngine').style.display = 'none';
		document.getElementById('settingsAbout').style.display = 'block';
	}
}

function settingsApply() { //save settings to local storge
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
	localStorage.setItem("customStartURL", document.getElementById("settingsStartURLOtherInput").value);  //alwayes save value of the other textbox for easy swiching.
}

function settingsGet() { //get settings from local storage.
	document.getElementById("settingsStartURLOtherInput").value = localStorage.getItem("customStartURL");

	if (localStorage.getItem("startURL") == "https://www.google.com") {
		document.getElementById("settingsStartURLRadio1").checked = true;
		return;
	}
	if (localStorage.getItem("startURL") == "https://www.bing.com") {
		document.getElementById("settingsStartURLRadio2").checked = true;
		return;
	}
	if (localStorage.getItem("startURL") == "https://search.yahoo.com") {
		document.getElementById("settingsStartURLRadio3").checked = true;
		return;
	}
	if (localStorage.getItem("startURL") == "https://www.duckduckgo.com") {
		document.getElementById("settingsStartURLRadio4").checked = true;
		return;
	}
	if (localStorage.getItem("startURL") == "https://www.ecosia.org") {
		document.getElementById("settingsStartURLRadio5").checked = true;
		return;
	}
	document.getElementById("settingsStartURLRadio6").checked = true;
}

function setDefaultIfEmpty() { //if a setting hasn't been saved e.g. first time using the browser set it to default
	if (localStorage.getItem("startURL") == null) {
		localStorage.setItem("startURL", "https://www.google.com");  //default search engine is google
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
