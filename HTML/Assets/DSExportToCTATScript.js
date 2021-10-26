//declare global variables
var students = new Set();
var problemsAndPaths = {}; //problemsAndPaths[problem name][studentID] = [{stepID: <id>, selection: s, action: a, input: i}, ... ]
var studentTransactions = {};
var __rowVarsRaw = [];
var problems = [];
var cy;
var edgesToHide, nodesToHide;
var graph;
var edgeFreqs;
var allPaths;
var cy2;
var ui;
var interfaceFilePath;

var __stepReplayer;

//user-determined parameters
var detector_list = ["Detectors/system_misuse.js", "Detectors/critical_struggle.js", "Detectors/struggle__moving_average.js", "Detectors/student_doing_well__moving_average.js", "Detectors/idle.js"];
var KC_model = "KC (Default)";

var BKTparams = {p_transit: 0.2, 
                p_slip: 0.1, 
                p_guess: 0.2, 
                p_know: 0.25};
var BKThistory = {};
var pastSteps = {};
var pastStudentProblems = new Set();
var pastStudents = new Set();
var i=0;
currDetectorValues = {};
outputStr="";
var problemScripts=[];
var __fieldIdxs = {};
var __logKeyMap = {
	studentId: "Anon Student Id",
    sessionId: "Session Id",
    transactionId: "Transaction Id",
    toolTime: "CF (tool_event_time)",
    tutorTime: "CF (tutor_event_time)",
    problemName: "Problem Name",
    stepName: "Step Name",
    stepId: "CF (step_id)",
    selection: "Selection",
    action: "Action",
    input: "Input",
    outcome: "Outcome",
    helpLevel: "Help Level",
    totalNumHints: "Total Num Hints",
    actor: "Student Response Subtype",
    dateTime: "Time"
};

var __util = (function() {
	var s = location.search.substring(1); 
	var queryParams;
	try {
		queryParams = JSON.parse('{"' + s.replace(/&/g, '","').replace(/=/g,'":"') + '"}', function(k, v) { return k===""?v:decodeURIComponent(v) });
	} catch(e) {
		queryParams = {};
	}

	var tsRegex = /\.(\d{1,3})\sUTC$/; 
	return {
		getQueryParam: function(k) {
			return queryParams[k];
		},

		formatToolTime: function(ts) {
			let formatted = ts.replace(tsRegex, (m, g1)=> {
				let padN = 3-g1.length;
				for (let i = 0; i < padN; i++) {
					g1 = '0'+g1;
				}
				return "."+g1+" UTC";
			});
			return formatted;
		}
	};
})();

function getInterface() {
    interfaceFilePath = (__util.getQueryParam("interfaceFilePath") || document.getElementById('fileItem2').files[0].name);
    console.log("getInterface", interfaceFilePath, "typeof", typeof(interfaceFilePath), "\n question_file", CTATConfiguration.get('question_file'))
	return interfaceFilePath;
}

const TabManager = (function() {
	var tabMap = {};
	
	var tm = {
		addTab: function(tabId, studentName) {
			tabMap[tabId] = {
				student: studentName,
				probIdx: -1
			}
		},
		
		loadNextProblem: function(tabId) {
			var tabData = tabMap[tabId];
			tabData.probIdx++;
			var studentProblems = studentTransactions[tabData.student];
			var pNameAndIndex = studentProblems.__problemOrder[tabData.probIdx],
				pName = pNameAndIndex.name;
			var pData = studentProblems[pName][pNameAndIndex.idx];
			
			console.log("load problem ",pName," for student ",tabData.student);
			console.log("problem data: ",pData);
			
			if (pData) {
				let host = window.location.origin;
				let path = "/run_replay_problem_set_as_assignment/"+pData.packageName+"/"+pData.problemSet+"/"+pName;
				if (!isNaN(parseInt(pData.context, 10))) {
					path += '/'+pData.context;
				}
				let query = "?school_name="+pData.school+"&class_name="+pData.class+"&assignment_name="+pData.assignment+"&student_name="+tabData.student+"&reset=true&first=true";
				let url = host+path+query,
					urlEncoded = encodeURI(url);
				console.log("problem URL (raw): ",url);
				console.log("(encoded): ",urlEncoded);
				bc.postMessage({to: tabId, type: 'load', data: urlEncoded});
			}
		},
		
		runProblem: function(tabId) {
			var tabData = tabMap[tabId];
			var studentProblems = studentTransactions[tabData.student];
			var pNameAndIndex = studentProblems.__problemOrder[tabData.probIdx];
			var probData = studentProblems[pNameAndIndex.name][pNameAndIndex.idx];
			var steps = probData.transactions;
			var stepIdx = 0;
			var step;
			var i = setInterval(()=>{
				step = steps[stepIdx++];
				if (step) {
					this.sendStep(tabId, step);
				} else {
					clearInterval(i);
				}
			}, 1000);
		},
		
		sendStep: function(tabId, step) {
			bc.postMessage({to: tabId, type: 'step', data: step});
		}
	};
	
	var bc = new BroadcastChannel('student_transactions');
	bc.onmessage = function(msg) {
		msg = msg.data;
		console.log(`got message ${msg.data} from ${msg.sender}`);
		if (msg.data === "next problem") {
			tm.loadNextProblem(msg.sender);
		} else if (msg.data === "ready") {
			tm.runProblem(msg.sender);
		}
	}
	
	return tm;
})();

function StepReplayer() {
	var atStep = 0;
	var steps = [];
	var uiWindow = null;
	var stepTable = null;
	var highlightedRowN = 0;

	function highlightNextStep() {
		var tBody = stepTable.querySelector("tbody"),
			rowToHighlight = tBody.childNodes[atStep],
			oldRow = tBody.childNodes[highlightedRowN];

		oldRow && oldRow.classList.remove("highlight");
		rowToHighlight && rowToHighlight.classList.add("highlight");
		highlightedRowN = atStep;
	};

	this.setSteps = function(stepList) {
		atStep = 0;
		steps = stepList;
	}

	this.setUiWindow = function(win) {
		uiWindow = win;
	}

	this.setStepTable = function(t) {
		stepTable = t;
		highlightNextStep();
	}

	this.sendNextStep = function() {
		let sai = steps[atStep];
		if (sai.input === "hint request") {
			if (sai.selection === "hint") {
				uiWindow.CTATCommShell.commShell.requestHint();
				console.log("\trequest hint");
			} else {
				console.log("\tprevious/next button press, skip...");
			}
		} else {
			let ctatSAI = new CTATSAI(sai.selection, sai.action, sai.input),
				stepType = "ATTEMPT";
			console.log("\tsend sai: "+sai.selection+","+sai.action+","+sai.input+", ("+(sai.tutored ? "" : "un")+"tutored)");
			uiWindow.CTATCommShell.commShell.processComponentAction(
															ctatSAI, //sai
															sai.tutored, //tutored
															true, //behavior recorded
															null,  //[deprecated]
															stepType, //log type
															null, //aTrigger
															sai.transactionID //transaction id
															);
		}
		atStep++;
		highlightNextStep();
	};
	
	this.sendUpToStep = function(stepN) {
		while(atStep < stepN) {
			this.sendNextStep();
		}
	};

	this.sendUpThroughStep = function(stepN) {
		while(atStep <= stepN) {
			this.sendNextStep();
		}
	};

	this.sendAllSteps = function() {
		this.sendUpToStep(steps.length);	
	};
};

//<input type="button" value="Add Selected Path to BG" id="bgAddButton" onclick="addPathToBG()" />
function addPathToBG(correct) {
    console.log("addPathToBG called");
    path = cy.$(":selected");

    path.forEach(function(ele) {
        if (!ele.isNode()) {
            if (!("correct" in ele.data())) {
                if (correct==1)
                    ele.json({data : {correct: 1}})
                else if (correct==0)
                    ele.json({data : {correct: 0}})
                else
                    ele.json({data : {correct: -1}})
            }
        }
    });
}

function getSelectedPath() {
    console.log("called");
    //get all selected nodes
    var selectedNodes = cy.$(":selected");
    var firstSelect = selectedNodes[0];
    var root = cy.$('node[id="0"]');
    //use dijkstra's to get path
    var dijkstra = cy.elements().dijkstra('node[id="0"]',
        function() {
              return 1;
            }, false);
    var path = dijkstra.pathTo(firstSelect);
    path.select();

    //first log the SAIs in path
    path.edges().forEach(function(edge) {
        console.log(edge.data("info"))
    });
    return path;
}

function addPathXToInterface() {
    console.log("addPathXToInterface called");

    getInterface();

    cy.$().unselect();
    x = document.getElementById("currentPathNum").value;
    pathNum = parseInt(x);
    console.log(x);
    if (!isNaN(pathNum)) {
        path = allPaths[pathNum-1];
        path.select();
        var msgs = [], builder = new CTATTutoringServiceMessageBuilder();
        path.edges().forEach(function(edge) {
            msgs.push(builder.createInterfaceActionMessage(CTATGuid.guid(), new CTATSAI(edge.data("selection"),
                                                                                        edge.data("action"),
                                                                                        edge.data("input"))));
        });

		if (ui != null || !ui.closed) {
				ui.window.close();
		}
		openTutorInNewWindow(sendStepsToTutor.bind(this));
	}
}

function nextPath() {
    currentPathInd = parseInt(document.getElementById("currentPathNum").value);
    if (!isNaN(currentPathInd)) {
        if (currentPathInd < allPaths.length) {
            document.getElementById("currentPathNum").value = currentPathInd+1;
        }
    }
    addPathXToInterface();
}

function prevPath() {
    currentPathInd = parseInt(document.getElementById("currentPathNum").value);
    if (!isNaN(currentPathInd)) {
        if (currentPathInd > 1) {
            document.getElementById("currentPathNum").value = currentPathInd-1;
        }
    }
    addPathXToInterface();
}

function openTutorInNewWindow(onloadFunc) {
	let iPath = document.getElementById("interfacePathInput").value || __util.getQueryParam("interfaceFilePath") || null,
		qFile = document.getElementById("questionFileInput").value || __util.getQueryParam("question_file") || null,
		doLogging = document.getElementById("doLoggingInput").checked,
		datasetName = document.getElementById("logDatasetInput").value || null,
		logServiceURL = "https://pslc-qa.andrew.cmu.edu/log/server";

	if (iPath) {
		if (qFile) {
			let queryStr = "?replay_mode=true&question_file="+qFile;
			if (doLogging && !datasetName) {
				alert("specify the dataset name to be used for logging");
			} else {
				doLogging && (queryStr+="&Logging=ClientToLogServer&dataset_name="+datasetName+"&log_service_url="+logServiceURL);
				ui=window.open(iPath+queryStr);
    			if (onloadFunc) {
					ui.window.onload = onloadFunc;
    			}
				ui.window.onclose = (function() {
    			    ui = null;
    			}).bind(this);
				__stepReplayer.setUiWindow(ui.window);
			}
		} else {
			alert("specify the question file");
		}
	} else {
		alert("specify the interface file");
	}
}

//send a series of messages of the form created by CTATTutorMessageBuilder
function sendStepsToTutor(msgs) {
	msgs.forEach((m) => ui.window.CTAT.ToolTutor.sendToInterface(m));
}

//send a series of sais
function sendSAIsToTutor(sais) {
	console.log("sendSAIsToTutor");
	sais.forEach((sai)=>{
		if (sai.input === "hint request") {
			if (sai.selection === "hint") {
				ui.window.CTATCommShell.commShell.requestHint();
				console.log("\trequest hint");
			} else {
				console.log("\tprevious/next button press, skip...");
			}
		} else {
			let ctatSAI = new CTATSAI(sai.selection, sai.action, sai.input),
				stepType = "ATTEMPT";
			console.log("\tsend sai: "+sai.selection+","+sai.action+","+sai.input+", ("+(sai.tutored ? "" : "un")+"tutored)");
			ui.window.CTATCommShell.commShell.processComponentAction(
																ctatSAI, //sai
																sai.tutored, //tutored
																true, //behavior recorded
																null,  //[deprecated]
																stepType, //log type
																null, //aTrigger
																sai.transactionID //transaction id
																);
		}
	});
}

function addPathToInterface() {
    console.log("addPathToInterface called");

    getInterface();

    //get all selected nodes/edges
    //path = getSelectedPath();
    path = cy.$(":selected");
    
    //first log the SAIs in path
    path.edges().forEach(function(edge) {
        console.log(edge.data("info"))
    });
    

    //now we need to pass it on somehow
    var msgs = [], builder = new CTATTutoringServiceMessageBuilder();
    path.edges().forEach(function(edge) {
        msgs.push(builder.createInterfaceActionMessage(CTATGuid.guid(), new CTATSAI(edge.data("selection"),
                                                                                    edge.data("action"),
                                                                                    edge.data("input"))));
    });

    msgs.forEach(function(msg) {
        console.log(msg)
    });

    if (ui && !ui.closed) {
        ui.window.close();
    }
	openTutorInNewWindow(sendStepsToTutor.bind(this, msgs));
}

function displayNMostFrequentPaths() {
    var N = parseInt(document.getElementById("N_form").value);
    var a = parseInt(document.getElementById("a_form").value);
    console.log(N);
    console.log(a);
    a = a-1;

    //want the ath through (a+N)th most frequent paths
    //a corresponds to a-1 index -- we want to keep it
    //a+N corresponds to a+N-1 index -- we want to keep it
    
    if (nodesToHide != null)
        nodesToHide.show();
    if (edgesToHide != null)
        edgesToHide.show();
    //disclaimer: these hide() and show() functions aren't documented
    
    //allPaths is sorted based on pathFreqs already in buildVisualization()

    //maybe it's easier to hide everything and then only show the N most frequent ones
    nodesToHide = cy.nodes();
    edgesToHide = cy.edges();
    nodesToHide.hide();
    edgesToHide.hide();
    //all nodes that are in a kept path are kept
    //all edges that are in a kept path are kept
    toKeep = allPaths.slice(a,a+N);
    for (var j = 0; j < toKeep.length; j++) {
        //allPaths[toKeep[j][0]].show();
        toKeep[j].show();
    }
    //return allPaths;
}

//not useful anymore
//this one and updateEdgeFreqs only work after having some graph displayed
function displayNMostFrequent() {
    var N = parseInt(document.getElementById("N_form").value);
    var a = parseInt(document.getElementById("a_form").value);

    //want to only display edges [a, a+N] most frequent
    [g, edgeFreqs] = buildGraphForProblem();
    var freqsArray = Object.entries(edgeFreqs);

    freqsArray.sort(function(e1,e2) {
        return -(e1[1] - e2[1]);
    });

    var subArray = freqsArray.slice(a, a+N);
    //
    //convert back to object
    var subObj = subArray.reduce(function(acc, cur, i) {
        acc[cur[0]] = cur[1];
        return acc;
    }, {});

    if (nodesToHide != null)
        nodesToHide.restore();
    if (edgesToHide != null)
        edgesToHide.restore();
    var edgeFreq = parseInt(document.getElementById("edgeFreq").value);
    edgesToHide = cy.filter(function(element, i) {
        if (element.isEdge() && !(element.data("CTATid") in subObj))
            return true;
        return false;
    });
    nodesToHide = cy.filter(function(element, i) {
        if (element.isNode()) {
            var keep = false;
            element.connectedEdges().forEach(function(edge, ind) {
                if (edge.data("CTATid") in subObj)
                    keep = true;
            });
            return !keep;
        }
    })
    edgesToHide.remove();
    nodesToHide.remove();
}

function updateEdgeFreqs() {
    if (nodesToHide != null)
        nodesToHide.restore();
    if (edgesToHide != null)
        edgesToHide.restore();
    var edgeFreq = parseInt(document.getElementById("edgeFreq").value);
    edgesToHide = cy.filter(function(element, i) {
        if (element.isEdge() && element.data("freq") < edgeFreq)
            return true;
        return false;
    });
    nodesToHide = cy.filter(function(element, i) {
        if (element.isNode()) {
            var keep = false;
            element.connectedEdges().forEach(function(edge, ind) {
                if (edge.data("freq") >= edgeFreq)
                    keep = true;
            });
            return !keep;
        }
    })
    edgesToHide.remove();
    nodesToHide.remove();
}

function buildVisualization() {
    cy = cytoscape({
        container: document.getElementById('cy'),
        hideLabelsOnViewport: true
    });
    cy.json(JSON.parse(buildJSON(graph, edgeFreqs)));
    var layout = cy.layout({
                    name: 'cose',
                    fit: true,
                    padding: 30,
                    boundingBox: undefined,
                    nodeDimensionsIncludeLabels: false,
                    randomize: true,
                    componentSpacing: 40,
                    nodeRepulsion: function( node ){ return 1020480; },
                    nodeOverlap: 4,
                    idealEdgeLength: function( edge ){ return 50; },
                    edgeElasticity: function( edge ){ return 32; },
                    nestingFactor: 1.2,
                    gravity: 0.1
                 });
    layout.run();

    allPaths = [];
    cy.nodes().leaves().forEach(function(leaf) {
        var dijkstra = cy.elements().dijkstra('node[id="0"]',
            function() {
                  return 1;
                }, false);
        var path = dijkstra.pathTo(leaf);
        allPaths.push(path);
    });

    pathFreqs = [];//entries are [original index, path freq]
    for (var i = 0; i < allPaths.length; i++) {
        //freq of path i = min freq of its edges
        total = 0;
        allPaths[i].edges().forEach(function(e){total += e.data("freq")});
        //or instead do average freq because that's probably more useful it seems
        pathFreqs[i] = [i,total/allPaths[i].edges().length];
    }
    pathFreqs.sort(function(a,b) {return b[1]-a[1]});
    sortedAllPaths = []
    for (var i = 0; i < allPaths.length; i++) {
        sortedAllPaths.push(allPaths[pathFreqs[i][0]])
    }
    allPaths = sortedAllPaths

    cy.nodes().on('select', function(event) {
            getSelectedPath();
    });

    document.getElementById("N_form").value = allPaths.length
    document.getElementById("N_form").text = allPaths.length

    //populate overall info fields
    document.getElementById("numStudents").value = students.size;
    document.getElementById("numProblems").value = problems.length;

    //populate problem-specific info
    //need to update on switching problem too...
    pathLens = allPaths.map(function(path) {//path length is = to # of edges
        return path.edges().length;
    });
    totalLen = 0;
    for (i=0;i<pathLens.length;i++) {
        totalLen += pathLens[i];
    }
    document.getElementById("averagePathLength").value = Math.round(totalLen/pathLens.length)
    document.getElementById("longestPath").value = Math.min(...pathLens)
    document.getElementById("shortestPath").value = Math.max(...pathLens)

    var chosenProblem = 0;
    var problemRadios = document.getElementsByName("problem");
    for (var k = 0; k < problems.length; k++) {
        if (problemRadios[k].checked) {
            chosenProblem = k;
            break;
        }
    }

    document.getElementById("numStudentsProblem").value = Object.entries(problemsAndPaths[problems[chosenProblem]]).length

    totalSAIs=0;
    objectified = Object.entries(edgeFreqs)
    objectified.forEach(function(entry) {totalSAIs += entry[1]});
    document.getElementById("numSAIs").value = totalSAIs;

    //totalSAs = 0;
    allSAs = {};
    bigArray = Object.entries(problemsAndPaths) //[[problemID, {studentID: [<steps>]}], ... ]
    for (var problemInd = 0; problemInd < bigArray.length; problemInd++) {
        problemArray = Object.entries(bigArray[problemInd][1]); //[[studentID, [<steps>]], ...]
        for (var studentInd = 0; studentInd < problemArray.length; studentInd++) {
            saiList = problemArray[studentInd][1] //[{<step>}, ...]
            for (var SAind = 0; SAind < saiList.length; SAind++) {
                if (!allSAs.hasOwnProperty(saiList[SAind].selection)) {
                    allSAs[saiList[SAind][0]] = 1;
                }
            }
        }
    }

    //totalSAs = Object.entries(allSAs)
    document.getElementById("numSAs").value = Object.entries(allSAs).length;

    document.getElementById("averageEdgeFrequency").value = Math.round(totalSAIs/objectified.length)

    document.getElementById("currentPathNum").value = 1//reset
}

function buildGraphForProblem(p) {
    //get params from the form (it should have defaults too)
    //for problem #:
    var chosenProblemIdx = 0;
    var problemRadios = document.getElementsByName("problem");
    for (var k = 0; k < problems.length; k++) {
        if (problemRadios[k].checked) {
            chosenProblemIdx = k;
            break;
        }
    }
	var chosenProblemName = p || problems[chosenProblemIdx];
	console.log("chosen problem: " + chosenProblemName);

    //ordered/unordered
    var ordered = $('input[name=ordered]:checked').val();
    console.log("ordered? " + ordered);

    var problem = problemsAndPaths[chosenProblemName];
    
	//start by sorting paths by length and SAIs
    var entries = Object.entries(problem); //entries = [[studentID1, [{step1}, ... {stepN}]], ... [studentIDN, [{step1, ... {<stepN>}]]]

    //sorting entries by path length, longest to shortest
    entries.sort(function(a,b){
        return -(a[1].length - b[1].length);//want descending order
    });

    //unordered case:
    //we now want to get the average position of edges within all paths
    //like say you have edge E and it appears in some subset of the paths
    //go through each path where it appears and record its position
    //so then E is associated with an average position?

    //but we don't have edges until we start building the graph
    //we only have SAIs in some order within each path
    //so yeah we're actually sorting based on SAI position
    if (ordered==="unordered") {
        console.log("doing unordered");
        var SAIpositions = {};
        var averageSAIpositions = {};
        
		entries.forEach((studIDAndSteps)=> {
			studIDAndSteps[1].forEach((step, stepIdx)=> {
				if (!SAIpositions[step.stepID]) {
					SAIpositions[step.stepID] = [];
				}
				SAIpositions[step.stepID].push(stepIdx);
			});
		});

        //so now SAIpositions is populated; compute averages
		for (let stepID in SAIpositions) {
			averageSAIpositions[stepID] = 0;
			SAIpositions[stepID].forEach((saiIdx) => {
                averageSAIpositions[stepID] += saiIdx;
            });
            averageSAIpositions[stepID] /= SAIpositions[stepID].length;
		}

        //now sort steps by average position
        entries.forEach((studIDAndSteps)=> {
			studIDAndSteps[1].sort((stepA, stepB) => averageSAIpositions[stepA.stepID] - averageSAIpositions[stepB.stepID]);
		});

    } else {
        console.log("doing ordered");
    }

    //now need to do path branching outward (no inward yet)
    //also need to keep track of edge frequency
    //this means that I do an intermediate step before actually building the json?
    edgeFreqs = {};
    graph = new CTATExampleTracerGraph(false, true, null);//isOrdered, youStartYouFinish, givenVT... idk what all the settings do
    var nodeCounter = 0;
    var startNode = new CTATExampleTracerNode(nodeCounter);
    nodeCounter++;
    var edgeCounter = 0;
    graph.addNode(startNode);
    for (i = 0; i < entries.length; i++) {
        var previousNode = startNode;
        var studentId = entries[i][0];
        //console.log(studentId);
        var sais = entries[i][1];
        //console.log(sais.length);
        for (var ind = 0; ind < sais.length; ind++) {
            var selection = sais[ind].selection;
            var action = sais[ind].action;
            var input = sais[ind].input;
            //console.log(selection+" "+action+" "+input);

            var prevOutLinks = previousNode.getOutLinks();
            linksArray = Array.from(prevOutLinks);
            var matched = false
            for (var j = 0; j < linksArray.length && !matched; j++) {
                var defSAI = linksArray[j].getDefaultSAI();
                if (defSAI.getSelection().localeCompare(selection) == 0 && 
                    defSAI.getAction().localeCompare(action) == 0 &&
                    defSAI.getInput().localeCompare(input) == 0) {
                    //console.log("it's a match " + defSAI.toString());
                    //console.log(defSAI.getSelection()+" "+defSAI.getAction()+" "+defSAI.getInput());
                    //console.log(previousNode.getNodeID());
                    //console.log(linksArray[j].getNextNode());
                    //increment the freq of link at linksArray[j]...
                    edgeFreqs[linksArray[j].getUniqueID()] += 1;
                    //console.log(edgeFreqs[linksArray[j].getUniqueID()]);
                    matched = true
                    previousNode = graph.getNode(linksArray[j].getNextNode());
                }
            }
            if (matched || input === "hint request") {
                continue;
            }
            //new edge otherwise
            var newNode = new CTATExampleTracerNode(nodeCounter);
            graph.addNode(newNode);
            edgeFreqs[edgeCounter] = 1;
            var newLink = new CTATExampleTracerLink(edgeCounter, previousNode.getNodeID(), newNode.getNodeID());
            var SelectionMatchers = new CTATMatcher();
            var ActionMatchers = new CTATMatcher();
            var InputMatchers = new CTATMatcher();
            var actor = null;
            
            var vectorMatcher = new CTATVectorMatcher(SelectionMatchers, ActionMatchers, InputMatchers, actor);
            vectorMatcher.setDefaultSAI(new CTATSAI(selection, action, input, null));
            //vectorMatcher.setCaseInsensitive(caseInsensitive);
            //vectorMatcher.setLinkTriggered(linkTriggered);
            newLink.setMatcher(vectorMatcher);
            // OK so I need to make a new matcher and give it the selection, action, and input
            graph.addLink(newLink, null);//don't worry about groups for now
            previousNode.addOutLink(newLink);
            newNode.addInLink(newLink);
            nodeCounter++;
            edgeCounter++;
            previousNode = newNode;
        }
    }

}


function clone(obj) {
    var copy;

    // Handle the 3 simple types, and null or undefined
    if (null == obj || "object" != typeof obj) return obj;

    // Handle Date
    if (obj instanceof Date) {
        copy = new Date();
        copy.setTime(obj.getTime());
        return copy;
    }

    // Handle Array
    if (obj instanceof Array) {
        return obj.slice();
    }

    // Handle Object
    if (obj instanceof Object) {
        copy = {};
        for (var attr in obj) {
            if (obj.hasOwnProperty(attr)) copy[attr] = clone(obj[attr]);
        }
        return copy;
    }

    throw new Error("Unable to copy obj! Its type isn't supported.");
}



function simulateNewProblem(studentId, problemName){
    console.log("simulateNewProblem(", studentId, problemName,")");
    problemScripts.push({user_guid: studentId, studentInterface: "", problemFile: problemName, script: []});
    //also clear BKT pastSteps
    pastSteps = {};
}

function simulateNewStudent(studentId, problemName){
    simulateNewProblem(studentId, problemName);
    //also clear BKT pastSteps
    BKThistory = {};
}

//convert transaction to JSON format in which detectors
//  would typically receive transactions
function constructTransaction(e){
    //construct JSON message and return JSON

    var template = {
        actor: actor, 
        transaction_id: transactionId, 
        context: {
            class_description: "",
            class_instructor_name: "",
            class_name: "",
            class_period_name: "",
            class_school: "",
            context_message_id: "",
            dataset_level_name1: "",
            dataset_level_name2: "",
            dataset_level_type1: "",
            dataset_level_type2: "",
            dataset_name: "",
            problem_context: problemName,
            problem_name: problemName,
            problem_tutorFlag: "",
            study_condition_name1: "",
            study_condition_type1: ""
        }, 
        meta: {
            date_time: dateTime,
            session_id: sessionId,
            user_guid: studentId
        }, 
        semantic_event: "", 
        tool_data: {
            selection: selection,
            action: action,
            input: input,
            tool_event_time: toolTime
        }, 
        tutor_data: {
            selection: tutorSelection,
            action: tutorAction,
            input: input,
            action_evaluation: outcome,
            skills: [],
            step_id: stepId,
            tutor_advice: "",
            tutor_event_time: tutorTime
        }
    }
    
    return template
}

function getRowVariables(thisrow){
    if(!thisrow || !thisrow.length || !thisrow[0]) return false;
    var rowVars = {};
	//initialize all relevant indices
    
	if(i==0){
       	thisrow.forEach((key, idx)=> {
			
			if (__fieldIdxs[key]) {
				if (!(__fieldIdxs[key] instanceof Array)) {
					__fieldIdxs[key] = [__fieldIdxs[key]];
				}
				__fieldIdxs[key].push(idx);
			} else {
				__fieldIdxs[key] = idx;
			}
		});
    }
    else{
		for (let key in __fieldIdxs) {
			let idx = __fieldIdxs[key];
			if (idx instanceof Array) {
				idx.forEach((i, ii)=>rowVars[key+ii] = thisrow[i]);
			} else {	
				rowVars[key] = thisrow[idx];
			}
		}
        rowVars.currSkills = [];
        //populate skill names
        for (j in __fieldIdxs[KC_model]){
            var thisSkill = thisrow[__fieldIdxs[KC_model][j]];
            if (thisSkill!=""){
                rowVars.currSkills.push(thisSkill);
            }
        }

    }
    return rowVars;
}

function update_BKT(t){

    var currStep = t.tool_data.selection;
    for (var i in currSkills){
        var skill = currSkills[i];

        if(!(currStep in pastSteps)){
            if (!(skill in BKThistory)){    //if this skill has not been encountered before
                BKThistory[skill] = clone(BKTparams);
            }

            var p_know_tminus1 = BKThistory[skill]["p_know"];
            var p_slip = BKThistory[skill]["p_slip"];
            var p_guess = BKThistory[skill]["p_guess"];
            var p_transit = BKThistory[skill]["p_transit"];


            if (t.tutor_data.action_evaluation.toLowerCase()=="correct"){
                var p_know_given_obs = (p_know_tminus1*(1-p_slip))/( (p_know_tminus1*(1-p_slip)) + ((1-p_know_tminus1)*p_guess) );
            }
            else{
                var p_know_given_obs = (p_know_tminus1*p_slip)/( (p_know_tminus1*p_slip) + ((1-p_know_tminus1)*(1-p_guess)) );
            }
            
            BKThistory[skill]["p_know"] = p_know_given_obs + (1 - p_know_given_obs)*p_transit;

            //following TutorShop, round down to two decimal places
            BKThistory[skill]["p_know"] = Math.floor(BKThistory[skill]["p_know"] * 100) / 100;

        }

    }

    //update isNotFirstAttempt
    if(!(currStep in pastSteps)){
        pastSteps[currStep] = true;
    }

}

function getAllIndices(arr, val) {
    var indices = [], i;
    for(i = 0; i < arr.length; i++)
        if (arr[i] === val)
            indices.push(i);
    return indices;
}

// construct an InterfaceAction or UntutoredAction message from a transaction t
function txToStudentAction(t){
    if(!(/^student/.test(actor)))
        return null;
    if(/^hint/i.test(outcome))    // need multiple selections, actions to handle hint requests
        return null;
    if(/^hint/i.test(selection))  // need multiple selections, actions to handle hint requests
        return null;

    var saiMsg = "<message><verb>NotePropertySet</verb><properties><MessageType>";
    saiMsg += (outcome || /^done/i.test(selection) ? "InterfaceAction" : "UntutoredAction") + "</MessageType>";
    saiMsg += "<transaction_id>" + transactionId + "</transaction_id>";
    saiMsg += "<Selection><value>" + selection + "</value></Selection>";
    saiMsg += "<Action><value>" + action + "</value></Action>";
    saiMsg += "<Input><value><![CDATA[" + input + "]]></value></Input>";
    saiMsg += "</properties></message>";
    return saiMsg;
}

//test detectors on historical data (this function acts on one row)
function simulateDataStream(e, parser){
    var thisrow = e.data[0],
		rowVars;
	//console.log("simulateDataStream(i=="+i+")", e, thisrow);
    if(!(rowVars = getRowVariables(thisrow))) return;
	__rowVarsRaw.push(rowVars);
	console.log("simulateDataStream got rowVars: ",rowVars);
    if (i!=0){
        let problemName = rowVars["Problem Name"],
			studentId = rowVars["Anon Student Id"],
			selection = rowVars["Selection1"] ? "hint" : rowVars["Selection0"],
			action = rowVars["Action1"] ? "ButtonPressed" : rowVars["Action0"],
			input = rowVars["Input"],
			actor = (rowVars["Student Response Subtype"] === "tutor-performed") ? "tutor" : "student",
			feedback = rowVars["Feedback Text"] || "",
			timestamp = rowVars["CF (tool_event_time)"],
			pkg = rowVars["Level (Package)"],
			pSet = rowVars["Level (ProblemSet)"],
			ass = rowVars["Level (Assignment)"],
			schl = rowVars["School"],
			classs = rowVars["Class"],
			pCtxt = null
		console.log(problemName, pkg, pSet, ass, schl, classs);
		if (timestamp) {
			timestamp = __util.formatToolTime(timestamp);
		} else {
			console.log("no timestamp for row "+i);
		}
	
		if (!selection) {
			selection = (rowVars["Selection_1"] === "hint") ? "hint" : rowVars["Selection"];
			if (!selection) {
				console.log("no selection for row "+i);
			}
		}

		//task 2 stuff
        if (!problemsAndPaths.hasOwnProperty(problemName)) { //need to add the problem
            problemsAndPaths[problemName] = {};
            problems.push(problemName);
        }
        if (!problemsAndPaths[problemName].hasOwnProperty(studentId)) { //this student needs to be added to the problem
            problemsAndPaths[problemName][studentId] = [];
        }
		
		if (!studentTransactions.hasOwnProperty(studentId)) {
			studentTransactions[studentId] = {};
		}
		var thisStudent = studentTransactions[studentId];
		if (!thisStudent[problemName]) {
			thisStudent[problemName] = [];
		}
		var thisProblemName = thisStudent[problemName];
        //NtpDate is because it causes issues with the Large Dog Kennel; you get better results this way...
        if ((selection !== "NtpDate") && (actor === "student")) {
            let step = {
				stepID: rowVars["CF (step_id)"] || selection+"-"+action,
				transactionID: rowVars["Transaction Id"],
				selection: selection,
				action: action,
				input: input,
				tutored: rowVars["CF (tutor_event_time)"] !== '',
				timestamp: timestamp,
				outcome: rowVars["Outcome"],
				feedback: feedback
			};
			problemsAndPaths[problemName][studentId].push(step);
			
			var thisProblem = thisProblemName.find((p)=> p.context ? p.context === problemContext : true);
			if (!thisProblem) {
				thisProblem = {
					transactions: [step],
					packageName: pkg || __util.getQueryParam("package"),
					problemSet: pSet,
					context: pCtxt,
					school: schl,
					class: classs,
					assignment: ass
				}
				thisProblemName.push(thisProblem);
				console.log("added problem: ",thisProblem);
			} else {
				thisProblem.transactions.push(step);
			}
        }
		//take sessionID into account ?


        if (!(students.has(studentId))) {
            students.add(studentId);
        }
    }
    i++;
}

function buildChoices(container, groupName, values, onChange, inputType) {
	container.innerHTML = '';
	values.forEach((value, idx)=>{
		var radio = document.createElement("input");
        var label = document.createElement("label");
        radio.type = inputType;
        radio.name = groupName;
        radio.value = value;
        if (idx==0) {
            radio.checked = "checked";
        }
        container.appendChild(label);
		label.appendChild(radio);
        label.appendChild(document.createTextNode(value));
		container.appendChild(document.createElement("br"));
		onChange && radio.addEventListener('change', onChange.bind(radio, radio));
	});

}


function buildStepDisplay() {
	let stepContainer = document.getElementById("stepDisplay");
	if (stepContainer) {

		let problem = Array.prototype.find.call(document.getElementById("problemChoicesForm").querySelectorAll("input[type=radio]"), (r)=>r.checked).value,
			student = Array.prototype.find.call(document.getElementById("studentChoicesForm").querySelectorAll("input[type=radio]"), (r)=>r.checked).value,
			steps = problemsAndPaths[problem][student].slice(),
			nSteps = steps.length,
			tBody = stepContainer.querySelector("tbody"),
			stepTableLabel = document.getElementById("stepDisplayLabel");
	
		tBody.innerHTML = '';
		steps.forEach((s, i1)=> {
			let tr = document.createElement("tr");
			tBody.appendChild(tr);
			[i1, s.tutored, s.outcome, s.selection, s.action, s.input, s.feedback, s.timestamp].forEach((c, i2)=>{
				if (i2 === 1) {
					c = c ? "tutored" : "untutored";
				} else if (i2 === 2) {
					c = c || "N/A";
				}
				let td = document.createElement("td");
				td.innerHTML = c;
				tr.appendChild(td);
			});
		});

		stepTableLabel.innerHTML = "Steps ("+nSteps+")";
		__stepReplayer = new StepReplayer();
		__stepReplayer.setSteps(steps);
		__stepReplayer.setStepTable(stepContainer.querySelector("table"));
	} else {
		console.log("no stepDisplay element, skipping buildStepDisplay");
	}
}

function buildStudentChoices(probName) {
	console.log("buildStudentChoices: "+probName);
	var studentChoices = document.getElementById("studentChoicesForm"),
		students = Object.keys(problemsAndPaths[probName]);
	if (studentChoices) {
		buildChoices(studentChoices, "student", students, buildStepDisplay, "radio");
		buildStepDisplay();
	} else {
		console.log("no studentChoicesForm element, skipping buildStudentChoices");
	}
}

function buildGraphUI() {
	
	var singleStepBtn = document.getElementById("replayOneStepButton"),
		nStepsBtn = document.getElementById("replayNStepsButton"),
		nStepsInput = document.getElementById("stepNInput"),
		allStepsBtn = document.getElementById("replayAllStepsButton");
		
	singleStepBtn.addEventListener("click", ()=>__stepReplayer.sendNextStep());
	nStepsBtn.addEventListener("click", ()=>{
		let nSteps = nStepsInput.value;
		__stepReplayer.sendUpToStep(nSteps);
	});
	allStepsBtn.addEventListener("click", ()=>__stepReplayer.sendAllSteps());

	var problemChoices = document.getElementById("problemChoicesForm");
	buildChoices(problemChoices, "problem", problems, (radio)=>{
		buildStudentChoices(radio.value);
		buildGraphForProblem(radio.value);
	}, "radio");
	buildStudentChoices(problems[0]);
	buildGraphForProblem(problems[0]);
}

function buildEnactmentsUI() {
	var allStepsBtn = document.getElementById("replayAllStepsButton");
	var studentSelect = document.getElementById("studentSelectForm");
	buildChoices(studentSelect, "students", Object.keys(studentTransactions), null, "checkbox");
	allStepsBtn.addEventListener("click", replaySelectedStudents);
}

function buildUI() {
	if (window.__interface === "graph") {
		buildGraphUI();
	} else if (window.__interface === "enactments") {
		buildEnactmentsUI();
	}
}

function replaySelectedStudents() {
	let selected = Array.prototype.filter.call(document.getElementById("studentSelectForm").querySelectorAll("input[type='checkbox']"), (i)=>i.checked).map((i)=>i.value);
	selected.forEach((s)=> {
		openTabForStudent(s);
	});
}

function openTabForStudent(student) {
	console.log("OpenTabForStudent: ",student);
	let ui = window.open(`tutorContainer.html?tab_id=${student}`);
	console.log("got browser context ",ui);
	TabManager.addTab(student, student);
}

function sortTransactionList(tList) {
	tList.sort((sai1, sai2) => {
		return sai1.timestamp.localeCompare(sai2.timestamp);
	});
}

function sortSolutionPaths() {
	for (let problemId in problemsAndPaths) {
		let problem = problemsAndPaths[problemId];
		for (let studentId in problem) {
			sortTransactionList(problem[studentId]);
		}
	}
}

function sortReplayEnactmentData() {
	for (let student in studentTransactions) {
		let thisStudent = studentTransactions[student];
		let pOrder = [];
		for (let problem in thisStudent) {
			let thisProblem = thisStudent[problem];
			thisProblem.forEach((prob, i)=> {
				sortTransactionList(prob.transactions);
				pOrder.push({name: problem, idx: i}); 
			});
		}
		pOrder.sort((probA, probB) => {
			return thisStudent[probA.name][probA.idx].transactions[0].timestamp.localeCompare(thisStudent[probB.name][probB.idx].transactions[0].timestamp);
		});
		thisStudent.__problemOrder = pOrder;
	}
}

//called when papa finishes parsing
function doneParse() {
   	sortSolutionPaths(); 
	sortReplayEnactmentData();
	
	buildUI();
	if (window.__interface === "graph") {
		buildVisualization();
	}
}

function runReplay() {
	let probForm = document.getElementById("problemChoicesForm"),
		studForm = document.getElementById("studentChoicesForm"),
		probRadios = probForm.querySelectorAll("input[type=radio]"),
		studRadios = studForm.querySelectorAll("input[type=radio]"),
		probR = Array.prototype.find.call(probRadios, (r)=>r.checked),
		studentR = Array.prototype.find.call(studRadios, (r)=>r.checked),
		prob = probR && probR.value,
		stud = studentR && studentR.value;
	
	console.log("runReplay, problem is ",prob,"student is ",stud);
	let sais = problemsAndPaths[prob][stud];
	console.log("got steps:",sais);

	if (ui && !ui.closed) {
		
		//sendSAIsToTutor( sais );
		__stepReplayer.sendAllSteps();
	
	} else {
		alert("first open the tutor using the 'launch interface' button");
	}
}

function downloadCSV(args) {  
        var csvData = new Blob([outputStr], {type: 'text/csv;charset=utf-8;'});

        exportFilename = args.filename || 'export.csv';

        //IE11 & Edge
        if (navigator.msSaveBlob) {
            navigator.msSaveBlob(csvData, exportFilename);
        } else {
            //In FF link must be added to DOM to be clicked
            var link = document.createElement('a');
            link.href = window.URL.createObjectURL(csvData);
            link.setAttribute('download', exportFilename);
            document.body.appendChild(link);    
            link.click();
            document.body.removeChild(link);    
        }
    }
