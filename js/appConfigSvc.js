/*
A service that will return the configuration object for the application. Currently this defines the servers to use...
*/


angular.module("sampleApp")
    //this returns config options. At the moment it is for servers...
//also holds the current patient and all their resources...
    //note that the current profile is maintained by resourceCreatorSvc

    .service('appConfigSvc', function($localStorage,$http,$timeout,$q) {

        var dataServer;     //the currently selected data server server
        var currentPatient;    //the currently selected patint
        var allResources;       //all resources for the current patient

        //the default config for a new browser...
        var defaultConfig;
/*
        //todo - not currently being used as thre are synchronous uses of defaultConfig
        $http.get("config.json").then(
            function(data) {
                console.log(data.data);
                defaultConfig = data.data;
            }
        );


        */

        defaultConfig = {servers : {}};
        defaultConfig.baseSpecUrl = "http://hl7.org/fhir/";     //the base for spec documentation
        defaultConfig.logLevel = 0;     //0 = no logging, 1 = log to console
        defaultConfig.enableCache = false;  //whether caching is supported
        defaultConfig.servers.terminology = "http://fhir3.healthintersections.com.au/open/";
        //defaultConfig.servers.terminology = "http://fhir.hl7.org.nz/dstu2/";
        defaultConfig.servers.data = "http://fhirtest.uhn.ca/baseDstu3/";
        //defaultConfig.servers.conformance = "http://fhir2.healthintersections.com.au/open/";
        defaultConfig.servers.conformance = "http://fhir3.healthintersections.com.au/open/";

        //default to Grahames DSTU2 server when data and conformance servers are inconsistent...
        defaultConfig.defaultTerminologyServerUrl = "http://fhir3.healthintersections.com.au/open/";
        //defaultConfig.defaultTerminologyServerUrl = "http://fhir.hl7.org.nz/dstu2/";

        defaultConfig.terminologyServers = [];
        //defaultConfig.terminologyServers.push({name:'HL&version:2,url:"http://fhir.hl7.org.nz/dstu2/"});
        defaultConfig.terminologyServers.push({name:'Grahames Server',version:2,url:"http://fhir2.healthintersections.com.au/open/"});
        defaultConfig.terminologyServers.push({name:'Grahames Server',version:3,url:"http://fhir3.healthintersections.com.au/open/"});
        //defaultConfig.terminologyServers.push({name:'Ontoserver',version:3,url:"http://ontoserver.csiro.au/stu3/"});
        defaultConfig.terminologyServers.push({name:'Ontoserver',version:3,url:"http://52.63.0.196:8080/fhir/"});
        defaultConfig.terminologyServers.push({name:'Public HAPI STU3',version:3,url:"http://fhirtest.uhn.ca/baseDstu3/"});


        

        defaultConfig.allKnownServers = [];

        defaultConfig.allKnownServers.push({name:"Grahames STU2 server",url:"http://fhir2.healthintersections.com.au/open/",version:2,everythingOperation:true});
        defaultConfig.allKnownServers.push({name:"Grahame STU3 server",url:"http://fhir3.healthintersections.com.au/open/",version:3,everythingOperation:true});

        defaultConfig.allKnownServers.push({name:"HealthConnex STU2 server",url:"http://sqlonfhir-dstu2.azurewebsites.net/fhir/",version:2,everythingOperation:true});
        defaultConfig.allKnownServers.push({name:"HealthConnex STU3 server",url:"http://sqlonfhir-may.azurewebsites.net/fhir/",version:3,everythingOperation:true});

        defaultConfig.allKnownServers.push({name:"Local HAPI STU2",url:"http://localhost:8080/baseDstu2/",version:2,everythingOperation:true});
        defaultConfig.allKnownServers.push({name:"Local HAPI STU3",url:"http://localhost:8080/baseDstu3/",version:3,everythingOperation:true});

        defaultConfig.allKnownServers.push({name:"Public HAPI server STU2 server",url:"http://fhirtest.uhn.ca/baseDstu2/",version:2,everythingOperation:true});
        defaultConfig.allKnownServers.push({name:"Public HAPI server STU3 server",url:"http://fhirtest.uhn.ca/baseDstu3/",version:3,everythingOperation:true});
        defaultConfig.allKnownServers.push({name:"HL7 New Zealand STU2 server",url:"http://fhir.hl7.org.nz/baseDstu2/",version:2});
        defaultConfig.allKnownServers.push({name:'Ontoserver',version:3,url:"http://52.63.0.196:8080/fhir/"});
        defaultConfig.allKnownServers.push({name:'MiHIN',version:2,url:"http://52.72.172.54:8080/fhir/baseDstu2/"});
        defaultConfig.allKnownServers.push({name:'Simplifier',version:2,url:"https://simplifier.net/api/fhir/"});





        //place all the servers in a hash indexed by url. THis is used for the userConfig
        var allServersHash = {};
        defaultConfig.allKnownServers.forEach(function(server){
            allServersHash[server.url] = server;
        })


       // defaultConfig.allKnownServers.push({name:'Patients First Server',version:3,url:"http://its.patientsfirst.org.nz/RestService.svc/Terminz/"});




        return {
            setServerType : function(type,url) {
                //set a default server type
                defaultConfig.servers[type] = url;
                $localStorage.config = defaultConfig;
            },
            init : function(){
                $http.get("config.json").then(
                    function(data) {
                        console.log(data.data);
                        defaultConfig = data.data;
                        return;
                    }
                );
            },
            getServerByUrl : function(url) {
              //return the server definition  for a given url. Wouldn't need this if I was saving the object rather than the string
                
                for (var i=0; i < defaultConfig.allKnownServers.length;i++) {
                    if (defaultConfig.allKnownServers[i].url == url) {
                        return defaultConfig.allKnownServers[i];
                        break;
                    }
                }
                
            },
            checkConsistency : function() {
                //check that all the servers are on the same version
                var rtn = {consistent:true,terminologyServers:[]};       //return an object

                var tmp = [];
                //first get the descriptive objects for the servers...
                var config = $localStorage.config;
                config.allKnownServers.forEach(function(svr){
                    if (config.servers.data == svr.url) {tmp.push(svr)}
                    if (config.servers.conformance == svr.url) {tmp.push(svr)}
                });

                //now see if they are all the same version - will need a loop if more than 2!
                if (tmp.length < 2 || tmp[0].version !== tmp[1].version) {
                    //if they're not the same, then return all the servers so the user can choose
                    rtn.consistent = false;
                    rtn.terminologyServers = config.terminologyServers;

                    //select the default terminology server

                    $localStorage.config.servers.terminology = config.defaultTerminologyServerUrl;

                    return rtn;
                }

                //now make sure the terminology server is the correct version..
                //todo - need to think about how to handle where there is more than one terminology server, or Grahames is down...
                rtn.terminologyServers = [];    //this will be all terminlogy servers for this version...
                var version = tmp[0].version;       //the FHIR version
                for (var i=0; i <config.terminologyServers.length;i++) {
                    var s = config.terminologyServers[i];

                    if (s.version == version) {
                        rtn.terminologyServers.push(s)
                        $localStorage.config.servers.terminology = s.url;
                        console.log('setting  terminology server to '+s.url,'appConfig:config')
                    }
                }
                return rtn;
            },
            config : function() {

                if (! $localStorage.config) {
                    $localStorage.config = defaultConfig;
                }

                var config = $localStorage.config;

                //add a logging function...
                if (config.logLevel !== 0) {
                    config.log = function(display,location) {
                        console.log(location + ":" + display);
                    }
                } else {
                    //a disabled log;
                    config.log = function() {}
                }
                
                
                
                return config;

            },
            getAllServers : function() {
                //console.log(config.allKnownServers)
              return defaultConfig.allKnownServers;
            },
            setCurrentDataServerDEP : function(sb) {
                //set the current data server...
                dataServer = sb;
            },
            getCurrentDataServerBase : function(sb) {
                //return the base of the currently selected data server

                if (! $localStorage.config) {
                    $localStorage.config = defaultConfig;
                }
                return $localStorage.config.servers.data;
               

                //return dataServer.url;
            },
            getCurrentDataServer : function() {
                //return the currently selected data server

                //need to get the definition for the data server. This is not pretty...
                //note that the $localstorage will always be populated by a call to config above...
                for (var i=0; i < $localStorage.config.allKnownServers.length; i++){
                    var svr = $localStorage.config.allKnownServers[i];
                    if (svr.url == $localStorage.config.servers.data) {
                        return svr;
                    }
                }

                //return dataServer;
            },
            getCurrentConformanceServer : function() {
                for (var i=0; i < $localStorage.config.allKnownServers.length; i++){
                    var svr = $localStorage.config.allKnownServers[i];
                    if (svr.url == $localStorage.config.servers.conformance) {
                        return svr;
                    }
                }
            },
            setCurrentPatient : function(patient) {
                currentPatient = patient;
            },
            removeCurrentPatient : function(){
                currentPatient = null;      //I 
            },
            getCurrentPatient : function() {
                return currentPatient;
            },
            setAllResources : function(ar) {
                //toto refactor to perform the query. Right now that's done by 'supportSvc' which has this serice as a dependency,

                allResources = ar;
            },
            getAllResources : function() {
                return allResources;
            },
            addToRecentPatient : function(patient) {
                //add to list of recent patients
                var dataServerUrl = $localStorage.config.servers.data;

                $localStorage.recentPatient = $localStorage.recentPatient || [];
                var alreadyThere = false;
                var id = patient.id;
                for (var i=0; i < $localStorage.recentPatient.length; i++) {
                    var recentP = $localStorage.recentPatient[i];
                    if (recentP.serverUrl == dataServerUrl && recentP.patient.id == patient.id) {
                        //same patient on the same server
                        alreadyThere = true;
                        break;
                    }
                }

                if (! alreadyThere) {
                    $localStorage.recentPatient.push({patient:patient,serverUrl:dataServerUrl});
                }

            },
            getRecentPatient : function(){
                var dataServerUrl = $localStorage.config.servers.data;
                var lst = [];
                if ($localStorage.recentPatient) {
                    $localStorage.recentPatient.forEach(function(recentP){
                        if (recentP.serverUrl == dataServerUrl) {
                            lst.push(recentP.patient);
                        }
                    });

                }

                return lst;
            },
            addToRecentProfile : function(profile) {
                //add to the list of recent profiles...
                //replace any existing one - (changes may connectathon)
                var conformanceServerUrl = $localStorage.config.servers.conformance;
                
                $localStorage.recentProfile = $localStorage.recentProfile || [];
                var alreadyThere = false;
                var url = profile.url;
                for (var i=0; i < $localStorage.recentProfile.length; i++) {
                    var recent = $localStorage.recentProfile[i];
                    if (recent.profile.url == url && recent.serverUrl == conformanceServerUrl) {
                        recent.profile = profile;       //<<<< here is where the replacement occurs...
                        alreadyThere = true;
                        break;
                    }
                }

                if (! alreadyThere) {
                    $localStorage.recentProfile.push({profile:profile,serverUrl:conformanceServerUrl});
                }
                
            },
            removeRecentProfile : function(inx) {
                //remove the profile from the 'recents'list. If a project is active and in edit mode, then remove from the project as well
                $localStorage.recentProfile.splice(inx,1);
                //return $localStorage.recentProfile;
            },
            getRecentProfile : function(){
                //get the list of recent profiles from the current conformance server
                var conformanceServerUrl = $localStorage.config.servers.conformance;
                var lst = [];
                if ($localStorage.recentProfile) {
                    $localStorage.recentProfile.forEach(function(recent){
                        if (recent.serverUrl == conformanceServerUrl) {
                            lst.push(recent.profile);
                        }
                    });

                }

                return lst;
            },
            setProject : function(project) {
                var deferred = $q.defer();
                //set the 'recent profiles to a specific set. Used when setting up a 'project'...
                //note that the actual profile is not inclded - just the url

                //set the servers for the project (if specified)...
                if (project.servers.conformance) {
                    this.setServerType('conformance',project.servers.conformance.url) ;
                }

                if (project.servers.data) {
                    this.setServerType('data',project.servers.data.url) ;
                }


                //this.setServerType('terminology',project.servers.terminology.url) ;

                //set up the profiles in this project. First, set up the queries to load the profiles from the conformance server
                var recentProfile = [];
                var query = [];
                var conformanceSvr = this.getCurrentConformanceServer();    //this may heve been set by the project above...
                
                if (project.profiles) {
                    project.profiles.forEach(function(profile){

                        //if the profile entry in the project has a conformance server, then use that. Otherwise use the system default


                        var url = conformanceSvr.url + "StructureDefinition/"+profile.id
                        //var url = project.servers.conformance.url + "StructureDefinition/"+profile.id
                        if (profile.conformance) {
                            url = profile.conformance + "StructureDefinition/"+profile.id
                        }

                        query.push (
                            $http.get(url).then(
                                function(data) {
                                    //add the profile to the 'recent profiles' list
                                    var profile = data.data;
                                    recentProfile.push({serverUrl:project.servers.conformance.url,profile:profile})

                                },
                                function(err){
                                    console.log('error loading profile ' +url+' from project')
                                })
                        )


                    });
                }


                //load all the profiles references in the project...
                $q.all(query).then(
                    function() {
                        //recentProfile will be the list of profiles - set by the individual GET's above...
                        console.log(recentProfile);
                        $localStorage.recentProfile = recentProfile;
                        var lst = [];
                        recentProfile.forEach(function(p){
                            lst.push(p.profile);
                        })


                        deferred.resolve(lst)     //return the list of profiles...
                    }
                );



                return deferred.promise;
            },
            addProfileToProject : function (profile,project,fireBase) {
                //adds the profile to the current project (if not already present)
                project.profiles = project.profiles || []
                var isInProject = false;
                project.profiles.forEach(function(p){
                    if (p.url == profile.url) {
                        isInProject = true;
                    }
                })

                if (!isInProject) {
                    project.profiles.push({"name" :"profile","id" : profile.id,url:profile.url});
                    fireBase.$save(project)
                }

                
                
            },
            removeProfileFromProject : function (profile,project,fireBase) {
                //adds the profile to the current project (if not already present)
                project.profiles = project.profiles || []
                var index = -1;
                project.profiles.forEach(function(p,inx){
                    if (p.url == profile.url) {
                        index = inx
                    }
                })

                if (index > -1) {
                    project.profiles.splice(index,1);
                    fireBase.$save(project)
                }



            },
            clearProfileCache : function() {
                delete $localStorage.recentProfile;
            },
            clearPatientCache : function() {
                delete $localStorage.recentPatient;
            },
            loadUserConfig : function() {
                //load the config for the current user. Right now, there are no users to it's all the same config
                var deferred = $q.defer();
                //load all the project. Eventually this could be user specific...
                $http.get('artifacts/config.json').then(
                    function(data) {
                        var userConfig  = data.data;

                        userConfig.projects.forEach(function(project){
                            //set the servers to the server objects based on the url. Right now, the possible servers are hard coded...
                            project.servers.conformance.server = allServersHash[project.servers.conformance.url];
                            //project.servers.terminology.server = allServersHash[project.servers.terminology.url];
                            project.servers.data.server = allServersHash[project.servers.data.url];
                        })

                        deferred.resolve(userConfig)


                    }
                )
                return deferred.promise;
                
            }
        }
    });
