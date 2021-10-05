parseConfig = {
	delimiter: "",  // auto-detect
	newline: "",    // auto-detect
	quoteChar: '"',
	header: false,
	dynamicTyping: false,
	preview: 0,
	encoding: "",
	worker: false,
	comments: false,
	step: simulateDataStream,
	complete: doneParse,
	error: undefined,
	download: false,
	skipEmptyLines: false,
	chunk: undefined,
	fastMode: undefined,
	beforeFirstChunk: undefined,
	withCredentials: undefined
};

var scriptIndex = 4;
function runSimulation(){
	console.log("runSimpulation()");
	//update detector list with user-selected values
	//...
	inputFilePath = (__util.getQueryParam("inputFilePath") || document.getElementById('fileItem').files[0]);
	console.log(inputFilePath);

	problemsAndPaths = {};
	problems = [];
	edgesToHide = null;
	nodesToHide = null;
	i=0;
	var problemChoices = document.getElementById("problemChoicesForm");
	var l = problemChoices ? problemChoices.children.length : 0;
	//need to remove all the problems
	for (var tmp = 0; tmp < l; tmp++) {
		problemChoices.removeChild(problemChoices.children[0]);
	}

	Papa.parse(inputFilePath, parseConfig);

	location.search.split(/[?&]/).forEach(function(q) {
		let NV=q.split(/=/);
		if(NV.length>1 && NV[0]=="scriptIndex") 
			scriptIndex=NV[1]
	});
	if(scriptIndex===null) {
		console.log("no problemScripts[scriptIndex]", scriptIndex, problemScripts);
		return;
	}
}

function genScript() {
	if(!(problemScripts && problemScripts.length && problemScripts[scriptIndex])) {
		console.log("no problemScripts or scriptIndex", problemScripts, scriptIndex)
		alert("no problemScripts or scriptIndex");
		return;
	}
	let script=problemScripts[scriptIndex].script;
	for(let m=0; m<script.length; ++m) {
		console.log("process[",m,"]:", script[m]);
		alert("CTAT.ToolTutor.sendToTutor(script["+m+"]): "+script[m]);
		CTATCommShell.commShell.getCommLibrary().sendXML(script[m].replace("UntutoredAction","InterfaceAction"));
	}
}

function changeColor(str){
	document.getElementById(str).style.background='#000000';
}

function downloadAfterSave(d) {
	console.log("downloadAfterSave(",d,")");
	let a=document.createElement("a");
	a.id="a"+(new Date()).getTime();
	a.download=d.replace(/.*[\/]/, "");
	a.href=d;
	a.style="display: none;";
	document.body.appendChild(a);
	console.log("downloadAfterSave(): to click a", a);
	a.click();
	$(a).remove();
}

function saveFile(fileName, fileContent) {
	console.log("saveFile(", fileName, ", ",fileContent, ")")
	let fsAddr = (/127[.]0[.]0[.]1|localhost/.test(document.location.origin) ? "http://127.0.0.1:3000" : "/cgi-bin/htmlsave.sh");
	$.post(fsAddr+"?file="+fileName+"&guid="+CTATGuid.guid(), fileContent == null ? document.head.outerHTML+"\n"+document.body.outerHTML+"\n" : fileContent, null, "text").then(
		downloadAfterSave,
		function(j,t,r){console.log("err j", j, "; t", t, "; r", r, ";enderr")
	});
}

function saveBRD() {
	saveFile((CTATConfiguration.get("question_file") || 'DSExportToCTATScript.brd').replace(/.*\//,""),
		CTAT.ToolTutor.tutor.getGraph().toXML(CTAT.ToolTutor.tutor) || '<?xml version="1.0" encoding="UTF-8"?><stateGraph/>');
}

