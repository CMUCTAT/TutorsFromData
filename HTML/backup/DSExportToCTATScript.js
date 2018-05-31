// task 2 things
var problemsAndPaths = {};
var problems = [];

function runTask1GivenJSON() {
    console.log("button pressed 2");
    var cy = cytoscape({
        container: document.getElementById('cy')
    });
    var g = buildGraphForProblem(0);
    cy.json(JSON.parse(buildJSON(g)));
    var layout = cy.layout({name: 'cose'});
    layout.run();
}

function buildGraphForProblem(i) {
    problem = problemsAndPaths[problems[i]];

    //new stuff... task 2.5:
    //start by sorting paths by length and SAIs or something
    //ohh so length is overall, and within a path, you want the SAIs to be sorted in some canonical ordering
    var entries = Object.entries(problem)
    for (i = 0; i < entries.length; i++) {
        entries[i][1] = Object.entries(entries[i][1])
    }

    //sort by path length
    entries.sort(function(a,b){
        //each entry of problem is [studentId, object for sais]
        return -(a[1].length - b[1].length);//want descending order
    });

    //now go through each path and sort it too
    for (i = 0; i < entries.length; i++) {
        var sais = entries[i][1];
        sais.sort(function(a,b){
            //sort by selection
            return (a[0].toString()).localeCompare(b[0].toString());
        });
    }

    //now need to do path branching outward (no inward yet)

    var graph = new CTATExampleTracerGraph(false, true, null);//isOrdered, youStartYouFinish, givenVT
    var nodeCounter = 0;
    var startNode = new CTATExampleTracerNode(nodeCounter);
    nodeCounter++;
    var edgeCounter = 0;
    graph.addNode(startNode);
    for (i = 0; i < entries.length; i++) {
        var previousNode = startNode;
        var studentId = entries[i][0];
        console.log(studentId);
        var sais = entries[i][1];
        console.log(sais.length);
        for (var ind = 0; ind < sais.length; ind++) {
            var selection = sais[ind][0];
            var action = sais[ind][1][0];
            console.log(action);
            var input = sais[ind][1][1];
            console.log(selection+" "+action+" "+input);

            var prevOutLinks = previousNode.getOutLinks();
            linksArray = Array.from(prevOutLinks);
            var matched = false
            for (var j = 0; j < linksArray.length && !matched; j++) {
                var defSAI = linksArray[j].getDefaultSAI();
                console.log(defSAI.getSelection()+" "+defSAI.getAction()+" "+defSAI.getInput());
                if (defSAI.getSelection().localeCompare(selection) == 0 && 
                    defSAI.getAction().localeCompare(action) == 0 &&
                    defSAI.getInput().localeCompare(input) == 0) {
                    console.log("it's a match " + defSAI.toString())
                    //increment the freq of link at linksArray[j]...
                    matched = true
                    previousNode = graph.getNode(linksArray[j].getNextNode())
                }
            }
            if (matched) {
                continue;
            }

            var newNode = new CTATExampleTracerNode(nodeCounter);
            graph.addNode(newNode);

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
    /*
    Object.keys(problem).forEach(function(studentId, index) {
        var previousNode = startNode;
        console.log(studentId);
        var sais = problem[studentId];
        var selections = Object.keys(sais);
        console.log(selections.length);
        for (var ind = 0; ind < selections.length; ind++) {
            var selection = selections[ind];
            var action = sais[selection][0];
            var input = sais[selection][1];
            console.log(selection+" "+action+" "+input);

            var newNode = new CTATExampleTracerNode(nodeCounter);
            graph.addNode(newNode);

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
            nodeCounter++;
            edgeCounter++;
            previousNode = newNode;
        }
    });*/
    return graph;
}

//
//*assume transactions are grouped by student*
//


//user-determined parameters
var detector_list = ["Detectors/system_misuse.js", "Detectors/critical_struggle.js", "Detectors/struggle__moving_average.js", "Detectors/student_doing_well__moving_average.js", "Detectors/idle.js"];
var KC_model = "KC (Default)";


//declare global variables
//

var currSkills_indices;
var studentId_index; var sessionId_index; var transactionId_index; var toolTime_index; var tutorTime_index; var problemName_index;var stepName_index; var stepId; var stepId_index; var selection_index;var action_index;var input_index;var outcome_index;var helpLevel_index;var totalNumHints_index; var dateTime_index;
var studentId; var sessionId; var dateTime; var transactionId;var actor;var toolTime;var tutorTime;var problemName; var stepName;var selection;var action;var input;var outcome;var tutorSelection; var tutorAction;var helpLevel;var totalNumHints;
var currSkills;
var BKTparams = {p_transit: 0.2, 
                p_slip: 0.1, 
                p_guess: 0.2, 
                p_know: 0.25};
var BKThistory = {};
var pastSteps = {};var pastStudentProblems = new Set();var pastStudents = new Set();
var i=0;
currDetectorValues = {};
outputStr="";
var problemScripts=[];



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
        copy = [];
        for (var i = 0, len = obj.length; i < len; i++) {
            copy[i] = clone(obj[i]);
        }
        return copy;
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
    //initialize all relevant indices
    if(i==0){
        currSkills_indices = getAllIndices(thisrow, KC_model);
        studentId_index = thisrow.indexOf("Anon Student Id");
        sessionId_index = thisrow.indexOf("Session Id");
        transactionId_index = thisrow.indexOf("Transaction Id");
        toolTime_index = thisrow.indexOf("CF (tool_event_time)");
        tutorTime_index = thisrow.indexOf("CF (tutor_event_time)");
        problemName_index = thisrow.indexOf("Problem Name");
        stepName_index = thisrow.indexOf("Step Name");
        stepId_index =  thisrow.indexOf("CF (step_id)");
        selection_index = thisrow.indexOf("Selection");
        action_index = thisrow.indexOf("Action");
        input_index = thisrow.indexOf("Input");
        outcome_index = thisrow.indexOf("Outcome");
        helpLevel_index = thisrow.indexOf("Help Level");
        totalNumHints_index = thisrow.indexOf("Total Num Hints");
        actor_index = thisrow.indexOf("Student Response Subtype");
        dateTime_index = thisrow.indexOf("Time");
    }
    else{
        studentId = thisrow[studentId_index];
        sessionId = thisrow[sessionId_index];
        transactionId  = thisrow[transactionId_index];
        toolTime  = thisrow[toolTime_index];
        tutorTime  = thisrow[tutorTime_index];
        problemName  = thisrow[problemName_index];
        stepName  = thisrow[stepName_index];
        stepId = thisrow[stepId_index];
        tutorSelection = stepName.split(" ")[0];
        tutorAction = stepName.split(" ")[1];
        selection  = thisrow[selection_index];
        action  = thisrow[action_index];
        input = thisrow[input_index];
        outcome = thisrow[outcome_index];
        helpLevel = thisrow[helpLevel_index];
        totalNumHints = thisrow[totalNumHints_index];
        actor = (thisrow[actor_index]!="tutor-performed") ? "student" : "tutor";
        dateTime = thisrow[dateTime_index];

        currSkills = [];
        //populate skill names
        for (j in currSkills_indices){
            var thisSkill = thisrow[currSkills_indices[j]];
            if (thisSkill!=""){
                currSkills.push(thisSkill);
            }
        }

    }
    return true;
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

    var thisrow = e.data[0];
    console.log("simulateDataStream(i=="+i+")", e, thisrow);
    if(!getRowVariables(thisrow)) return;

    if (i!=0){
        //task 2 stuff
        if (!(problemsAndPaths.hasOwnProperty(problemName))) { //need to add the problem
            problemsAndPaths[problemName] = {};
            problems.push(problemName);
        }
        if (!(problemsAndPaths[problemName].hasOwnProperty(studentId))) { //this student needs to be added to the problem
            problemsAndPaths[problemName][studentId] = {};
        }
        //console.log(action);
        problemsAndPaths[problemName][studentId][selection] = [action,input];//add this row's SAI to the student's data
        //problemsAndPaths[problemName][studentId][selection+"-"+action]=input;//I guess we want to do it this way now?
        
        //original stuff
        //for this row, if student performed, 
        //construct a JSON transaction...
        if (!(pastStudents.has(studentId))) {
            simulateNewStudent(studentId, problemName);
            pastStudents.add(studentId);
        }
        else if (!( pastStudentProblems.has(studentId + problemName) )){
            simulateNewProblem(studentId, problemName);
            pastStudentProblems.add(studentId + problemName);
        }

        var t = constructTransaction();
        if(t)
        {
            let sai = txToStudentAction(t);
            if(sai) {
                problemScripts[problemScripts.length-1].script.push(sai);
            }

            //update currSkills, using BKT
            update_BKT(t);
            for (j in currSkills){
                var thisSkill = currSkills[j];
                if(thisSkill in BKThistory){
                    t.tutor_data.skills.push({name: thisSkill, category: "", pGuess:BKThistory[thisSkill]["p_guess"], pKnown: BKThistory[thisSkill]["p_know"], pLearn: BKThistory[thisSkill]["p_transit"], pSlip:BKThistory[thisSkill]["p_slip"]});
                }
            }
        }

        //each time a response is received from a detector, 
        //write it to output file
        //including the timestamp!
        //
    }


    i++

    
}


//open all detectors in detector_list as WebWorkers
//
//   set up event listeners
//
//var path = window.location.pathname;
//path = path.split("/").slice(0,-1).join("/");


function downloadCSV(args) {  
        // var data, filename, link;
        // var csv = outputStr;
        // if (csv == null) return;

        // filename = args.filename || 'export.csv';

        // if (!csv.match(/^data:text\/csv/i)) {
        //     csv = 'data:text/csv;charset=utf-8,' + csv;
        // }
        // data = encodeURI(csv);

        // link = document.createElement('a');
        // link.setAttribute('href', data);
        // link.setAttribute('download', filename);
        // link.click();

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
