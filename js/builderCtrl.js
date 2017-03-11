
angular.module("sampleApp")
    .controller('builderCtrl',
        function ($scope,$http,appConfigSvc,$q,GetDataFromServer,resourceCreatorSvc,RenderProfileSvc,builderSvc,
                  $timeout,$localStorage,$filter,profileCreatorSvc,modalService,Utilities,$uibModal,$rootScope,
                  $firebaseObject,logicalModelSvc,ResourceUtilsSvc) {

            $scope.input = {};
            $scope.input.dt = {};   //data entered as part of populating a datatype
            $scope.appConfigSvc = appConfigSvc;
            $scope.ResourceUtilsSvc = ResourceUtilsSvc;     //for the 1 line summary..
            $scope.thingToDisplay = 'scenario';

            GetDataFromServer.registerAccess('scnBld');

            var idPrefix = 'cf-';   //prefix for the id. todo should probably be related to the userid in some way...
            //load the library. todo THis will become slow with large numbers of sets...
            function refreshLibrary() {
                builderSvc.loadLibrary($localStorage.builderBundles).then(
                    function(arContainer){
                        $scope.libraryContainer = arContainer;

                    }
                );
            }

            refreshLibrary();       //initial load...


            $scope.displayServers = "Conformance: " + appConfigSvc.getCurrentConformanceServer().name
                + "<div>Data: " + appConfigSvc.getCurrentDataServer().name + "</div>"
                + "<div>Term: " + appConfigSvc.getCurrentTerminologyServer().name + "</div>";

            $scope.showSelector = true;
            $scope.toggleSelector = function(){
                if ($scope.showSelector) {
                    $scope.leftPaneClass = "col-sm-2 col-md-2"
                    $scope.midPaneClass = "col-md-5 col-sm-5"
                    $scope.rightPaneClass = "col-md-5 col-sm-5";
                } else {
                    $scope.leftPaneClass = "hidden"
                    $scope.midPaneClass = "col-md-7 col-sm-7"
                    $scope.rightPaneClass = "col-md-5 col-sm-5";
                }
                $scope.showSelector = !$scope.showSelector
            }

            $scope.toggleSelector()

            /*
             $scope.showLibrary = function(){

             $scope.libraryVisible = true;
             };

             */


            //---------- login stuff
            //called whenever the auth state changes - eg login/out, initial load, create user etc.
            firebase.auth().onAuthStateChanged(function(user) {


                if (user) {
                    $rootScope.userProfile = $firebaseObject(firebase.database().ref().child("users").child(user.uid));
                    logicalModelSvc.setCurrentUser(user);


                    //return the practitioner resource that corresponds to the current user (the service will create if absent)
                    GetDataFromServer.getPractitionerByLogin(user).then(
                        function(practitioner){
                            //console.log(practitioner)
                            $scope.Practitioner = practitioner;


                        },function (err) {
                            //just swallow errors... alert(err)
                        }
                    );

                    delete $scope.showNotLoggedIn;


                } else {
                    //console.log('no user')
                    logicalModelSvc.setCurrentUser(null);
                    $scope.showNotLoggedIn = true;
                    delete $scope.Practitioner;

                }
            });

            $scope.firebase = firebase;

            $scope.login=function(){
                $uibModal.open({
                    backdrop: 'static',      //means can't close by clicking on the backdrop.
                    keyboard: false,       //same as above.
                    templateUrl: 'modalTemplates/login.html',
                    controller: 'loginCtrl'
                })
            };

            $scope.logout=function(){
                firebase.auth().signOut().then(function() {

                    modalService.showModal({}, {bodyText: 'You have been logged out of clinFHIR'})

                }, function(error) {
                    modalService.showModal({}, {bodyText: 'Sorry, there was an error logging out - please try again'})
                });

            };

            //retrieve the categories for a sceanrio (will be the value of the DocumentReference.class
            builderSvc.getLibraryCategories().then(
               function(cs){
                   $scope.libraryCategories = cs
                   //problem with setting a default is that there are 2 dependany async operations...
                   //$scope.input.selectedLibraryCategory = cs.concept[0];    //to set the default in the library
                   //$scope.makeLibraryDisplayList($scope.input.selectedLibraryCategory);
                      // console.log(cs);
               }
            );

            $scope.changeSelectedScenarioConcept = function(category){
                $scope.selectedContainer.category = category;
            }

            $scope.makeLibraryDisplayList = function(category){
                delete $scope.selectedLibraryContainer;
                var code = category.code
                $scope.selectedLibraryList = [];
                $scope.libraryContainer.forEach(function(container){
                    if (container.category && container.category.code) {
                        if (container.category.code == code) {
                            $scope.selectedLibraryList.push(container)
                        }
                    }
                })

            };

            $scope.togglePatientDisplay = function(){
                if ($scope.thingToDisplay == 'patient') {
                    $scope.thingToDisplay = 'scenario'
                } else {
                    $scope.thingToDisplay = 'patient'
                }
            };


            //---------- related to document builder -------
            $rootScope.$on('docUpdated',function(event,composition){
                //console.log(composition)
                makeGraph();
            });

            function isaDocument() {
                $scope.isaDocument = false;
                delete $scope.compositionResource;

                $scope.selectedContainer.bundle.entry.forEach(function(entry){

               // }
                //$scope.resourcesBundle.entry.forEach(function(entry){
                    if (entry.resource.resourceType =='Composition') {
                        entry.resource.section = entry.resource.section || [];
                        $scope.compositionResource = entry.resource;
                        $scope.isaDocument= true;

                        $scope.generatedHtml = builderSvc.makeDocumentText($scope.compositionResource,$scope.selectedContainer.bundle);
                        //console.log(html)

                    }
                })
            }

            function addExistingResource(resource) {
                builderSvc.addResourceToAllResources(resource)
                $scope.selectedContainer.bundle.entry.push({resource:resource});
                $scope.selectedContainer.bundle.entry.sort(function(a,b){
                    //$scope.resourcesBundle.entry.sort(function(a,b){
                    if (a.resource.resourceType > b.resource.resourceType) {
                        return 1
                    } else {
                        return -1
                    }
                })
                makeGraph();
            }


            //view and change servers
            $scope.setServers = function(){
                $uibModal.open({
                    templateUrl: 'modalTemplates/setServers.html',
                    //size: 'lg',
                    controller: 'setServersCtrl'
                    }).result.then(function () {

                        refreshLibrary();   //as the data server may have changed
                })
            }


            $scope.findPatient = function(){
                delete $scope.resourcesFromServer;
                $uibModal.open({
                    backdrop: 'static',      //means can't close by clicking on the backdrop. stuffs up the original settings...
                    keyboard: false,       //same as above.
                    templateUrl: 'modalTemplates/searchForPatient.html',
                    size:'lg',
                    controller: 'findPatientCtrl'
                }).result.then(
                        function(resource){
                            //console.log(resource)
                            if (resource) {
                                $scope.currentPatient = resource;

                                addExistingResource(resource)

                                /*
                                builderSvc.addResourceToAllResources(resource)
                                $scope.selectedContainer.bundle.entry.push({resource:resource});
                                $scope.selectedContainer.bundle.entry.sort(function(a,b){
                                    //$scope.resourcesBundle.entry.sort(function(a,b){
                                    if (a.resource.resourceType > b.resource.resourceType) {
                                        return 1
                                    } else {
                                        return -1
                                    }
                                })
                                */
                                $scope.displayMode = 'view';

                                //load any existing resources for this patient...
                                getExistingData(resource)
                                /*
                                supportSvc.getAllData(appConfigSvc.getCurrentPatient().id).then(
                                    //returns an object hash - type as hash, contents as bundle - eg allResources.Condition = {bundle}
                                    function(data){
                                        $scope.resourcesFromServer = data;
                                        console.log($scope.resourcesFromServer);
                                    },
                                    function(err){
                                        console.log(err)
                                })

                                */

                                $scope.selectResource(resource,function(){
                                    $scope.waiting = false;
                                    makeGraph();
                                    drawResourceTree(resource);
                                    isaDocument();      //determine if this bundle is a document (has a Composition resource)

                                    $rootScope.$emit('addResource',resource);

                                });       //select the resource, indicating that it is a new resource...
                            }

                        }
                )
            }



            function createDownLoad(container){
                $scope.downloadLinkJsonContent = window.URL.createObjectURL(new Blob([angular.toJson(container.bundle, true)], {type: "text/text"}));
                $scope.downloadLinkJsonName = 'Scenario'; //container.name;
            }

            //note that the way we are recording validation is a non-compliant bundle...
            $scope.resetValidation = function(){
                //when a resource is altered, re-set the validation
                $scope.selectedContainer.bundle.entry.forEach(function(entry){
                    if (entry.resource.id == $scope.currentResource.id) {
                        delete entry.valid;
                    }
                })

            };

            $scope.validateAll = function(){
                var bundle = $localStorage.builderBundles[$scope.currentBundleIndex].bundle;
               // console.log(bundle);
                $scope.waiting = true;
                builderSvc.validateAll(bundle).then(
                    function(data){
                        //console.log(data.data)



                    },function(err){
                        console.log(err)

                    }
                ).finally(function(){
                    $scope.waiting = false;
                })



            }

            $scope.saveToFHIRServer =function() {
                var bundle = $localStorage.builderBundles[$scope.currentBundleIndex].bundle;
                //console.log(bundle);
                $scope.waiting = true;
                builderSvc.sendToFHIRServer(bundle).then(
                    function(data){
                        //console.log(data.data)

                        bundle.entry.forEach(function(entry){
                            entry.valid='saved'
                        })



                        modalService.showModal({}, {bodyText:'All the resources have been updated on the server.'});
                    },
                    function(err) {
                        modalService.showModal({}, {bodyText:'There was an error:'+angular.toJson(err)});
                        //console.log(err)
                    }
                ).finally(function(){
                    $scope.waiting = false;
                })
            };

            $scope.validate = function(entry) {
                //console.log(entry);
                $scope.selectResource(entry)


                $scope.showWaiting = true;
                Utilities.validate(entry.resource).then(
                    function(data){
                        var oo = data.data;
                        //console.log(data)
                        entry.valid='yes'
                        entry.response = {outcome:oo};


                    },
                    function(data) {
                        var oo = data.data;
                        entry.response = {outcome:oo};
                       // console.log(oo)
                        entry.valid='no'



                    }
                ).finally(function(){
                    $scope.waiting = false;
                })

            }

            //------------------------------------------------


            //called whenever the auth state changes - eg login/out, initial load, create user etc.
            firebase.auth().onAuthStateChanged(function(user) {
                //delete $scope.input.mdComment;
//console.log(user)
                if (user) {
                    //console.log(user)
                    $scope.user = {};
                    $scope.user.user = user;
                    $scope.user.profile = $firebaseObject(firebase.database().ref().child("users").child(user.uid));


                    //$rootScope.userProfile = $firebaseObject(firebase.database().ref().child("users").child(user.uid));

                    //logicalModelSvc.setCurrentUser(user);


                    //return the practitioner resource that corresponds to the current user (the service will create if absent)
                    GetDataFromServer.getPractitionerByLogin(user).then(
                        function(practitioner){
                            //console.log(practitioner)
                            $scope.user.practitioner = practitioner;

                        },function (err) {

                            // just swallow errors...alert(err)
                        }
                    );

                    delete $scope.showNotLoggedIn;


                } else {
                    //console.log('no user')
                    logicalModelSvc.setCurrentUser(null);
                    $scope.showNotLoggedIn = true;
                    delete $scope.Practitioner;
                    delete $scope.taskOutputs;
                    delete $scope.commentTask;
                    // No user is signed in.
                }
            });

            //datatypes for which there is an entry form
            $scope.supportedDt = ['ContactPoint','Identifier','CodeableConcept','string','code','date','Period','dateTime','Address','HumanName','Annotation','boolean']

            function getExistingData(patient) {
                delete $scope.resourcesFromServer;
                if (patient) {
                    //load any existing resources for this patient. Remove any resources currently in the scenario..

                    //var container = $localStorage.builderBundles[$scope.currentBundleIndex]
                    builderSvc.getExistingDataFromServer(patient).then(
                    //supportSvc.getAllData(patient.id).then(
                        //returns an object hash - type as hash, contents as bundle - eg allResources.Condition = {bundle}
                        function(data){
                            $scope.resourcesFromServer = data;


                            $scope.$broadcast('patientSelected',data);   //so the patient display controller knows
                        },
                        function(err){
                            console.log(err)
                        })
                }
            }

            $scope.currentBundleIndex = 0;     //the index of the bundle currently being used

            if (! $localStorage.builderBundles) {

                //modalService.showModal({}, {bodyText:'To get started, either create a new set or download one from the Library.'});
                $localStorage.builderBundles = []
                $scope.currentBundleIndex = -1;

                // var newBundle = {name:'Default',bundle:{resourceType:'Bundle',entry:[]}}
                // newBundle.bundle.id = idPrefix +new Date().getTime();
                // $localStorage.builderBundles = [newBundle]
            } else {
                if ($localStorage.builderBundles.length > 0) {
                   // $scope.resourcesBundle = $localStorage.builderBundles[$scope.currentBundleIndex].bundle;
                    $scope.selectedContainer = $localStorage.builderBundles[$scope.currentBundleIndex];

                    //create a hash (based on url) of all the resources in the
                    builderSvc.setAllResourcesThisSet($localStorage.builderBundles[$scope.currentBundleIndex].bundle);
                    $scope.currentPatient = builderSvc.getPatientResource();
                    getExistingData( $scope.currentPatient)
                    isaDocument();
                }

            }

            $scope.resourceFromServerSelected = function(bundle, inx) {
               // console.log(bundle, inx)

                addExistingResource(bundle.entry[inx].resource);
                bundle.entry.splice(inx,1)
                bundle.total --;
            }


            $scope.builderBundles = $localStorage.builderBundles;   //all the bundles cached locally...

            //set the base path for linking to the spec
            switch (appConfigSvc.getCurrentConformanceServer().version) {
                case 2:
                    $scope.fhirBasePath="http://hl7.org/fhir/";
                    break;
                case 3:
                    $scope.fhirBasePath="http://build.fhir.org/";
                    break;
            }

            $scope.setDirty = function(){
                $scope.selectedContainer.isDirty = true;
            };

            $scope.newBundle = function() {


                $uibModal.open({
                    templateUrl: 'modalTemplates/newSet.html',

                    controller: function ($scope,GetDataFromServer,appConfigSvc,categories) {

                        $scope.canSave = true;
                        $scope.categories = categories;
                        if (categories && categories.concept) {
                            $scope.category = categories.concept[0];
                        } else {
                            $scope.category = {code:'default',display:'Default',definition:'Default'}

                        }

                        $scope.server = appConfigSvc.getCurrentDataServer();
                        $scope.checkName = function(){
                            if ($scope.name) {
                                //alert($scope.name)
                                $scope.canSave = true;
                            }

                        };

                        $scope.save = function(){
                            //represent the category as a Coding. $scope.category is a concept
                            var cat = {code:$scope.category.code,display:$scope.category.display}
                            cat.system = 'http://clinfhir.com/fhir/CodeSystem/LibraryCategories';   //todo get from appConfig


                            $scope.$close({name:$scope.name,description:$scope.description,category:cat})
                        }

                    },
                    resolve : {
                        categories: function () {          //the default config
                            return $scope.libraryCategories;
                        }
                    }

                }).result.then(function(vo){
                    //console.log(vo)
                    if (vo.name) {
                        delete $scope.isaDocument
                        var newBundleContainer = {name:vo.name,bundle:{resourceType:'Bundle',entry:[]}};
                        newBundleContainer.description = vo.description;
                        newBundleContainer.bundle.id = idPrefix+new Date().getTime();
                        newBundleContainer.isDirty = true;
                        newBundleContainer.isPrivate = true;
                        newBundleContainer.category = vo.category;
                        $localStorage.builderBundles.push(newBundleContainer);
                        $scope.selectedContainer = newBundleContainer;
                        $scope.currentBundleIndex= $localStorage.builderBundles.length -1;

                       // console.log(newBundleContainer)


                        makeGraph();
                        delete $scope.currentResource;
                        delete $scope.currentPatient
                        $rootScope.$emit('newSet',newBundleContainer);
                    }
                });



            };

            //called when a library entry is selected to view. may be redundant...
            $scope.selectLibraryContainer = function(container,inx){

                delete $scope.canDeleteLibraryEntry;

                $scope.currentLibraryIndex = inx;
                $scope.selectedLibraryContainer = container;

                var user = logicalModelSvc.getCurrentUser();
                if (user) {
                    //as don't have to log in to see scenarios

                    //todo - just for now. Eventually need some kind of security infrastructure...
                    if (user.email == 'david.hay25@gmail.com') {
                        $scope.canDeleteLibraryEntry = true;
                        return;
                    }

                    //if the author of the scenario is the same as the user then can delete
                    if (container.author && container.author.length > 0) {
                        if (container.author[0].display == user.email) {
                            $scope.canDeleteLibraryEntry = true;
                        }
                    }
                }


            };

            $scope.deleteScenario = function(container){



                var modalOptions = {
                    closeButtonText: "No, I changed my mind",
                    actionButtonText: 'Yes, please remove it',
                    headerText: 'Remove Library entry',
                    bodyText: 'Are you sure you wish to remove this scenario from the Library? Retrieving it is possible, but messy. '
                };

                modalService.showModal({}, modalOptions).then(
                    function (){

                        builderSvc.deleteLibraryEntry(container).then(
                            function(data){
                                var msg = "The library entry has been deleted. It's still there in the history of the entry, but you'll need to recover it using REST. Contact David Hay for details."
                                modalService.showModal({}, {bodyText:msg});
                                delete $scope.canDeleteLibraryEntry;
                                refreshLibrary();
                            },
                            function(err) {
                                var msg = "Sorry, there was a error deleting the entry. Details:" + angular.toJson(err)
                                modalService.showModal({}, {bodyText:msg});
                            }
                        )
                    }
                )




            }

            //------------  Library functions ------------
            //$scope.libraries = [];

            $scope.downloadFromLibrary = function(inContainer){
                //note that the entry is a DocumentReference with a bundle as an attachment...
                if (inContainer) {




                    var container = angular.copy(inContainer);

                    var id = container.bundle.id;

                    //see if this set (based on the id) already exists.
                    var alreadyLocal = false;
                    $localStorage.builderBundles.forEach(function (item,inx) {
                        if (item.bundle.id == id) {
                            alreadyLocal = true;
                            modalService.showModal({}, {bodyText:'There is already a copy of this set downloaded. Selecting it now.'});
                            // $scope.resourcesBundle = item.bundle;
                            $scope.selectedContainer = item;
                            $scope.currentBundleIndex= inx;
                            //$scope.libraryVisible = false;
                            $scope.thingToDisplay='scenario'
                        }
                    });

                    if (! alreadyLocal) {


                        //remove all the 'valid' propertis on entry...
                        container.bundle.entry.forEach(function (entry) {
                            delete entry.valid;
                        });



                        $localStorage.builderBundles.push(container);
                        //$localStorage.builderBundles.push(newBundle);
                        // $scope.resourcesBundle = newBundle.bundle;

                        $scope.selectedContainer = container;//newBundle;
                        $scope.currentBundleIndex= $localStorage.builderBundles.length -1;

                        builderSvc.setAllResourcesThisSet($localStorage.builderBundles[$scope.currentBundleIndex].bundle);  //needed for the 'resource from reference' functionity
                        makeGraph();
                        delete $scope.currentResource;      //so the previous resource details aren't being shown...
                        //$scope.libraryVisible = false;      //hide the library
                        $scope.thingToDisplay='scenario'
                        isaDocument();      //see if this set is a document (has a Composition resource)
                        modalService.showModal({}, {bodyText:'The set has been downloaded from the Library. You can now edit it locally.'});

                        refreshLibrary();       //so the download link is disabled...


                    } 
                } else {
                    alert('There was a problem retrieving the set (id='+ dr.id + ") from the library");
                }
                
              


            };

            //save the current scenario to the library
            $scope.saveToLibrary = function(){

                var user = logicalModelSvc.getCurrentUser();

                if (! user) {
                    modalService.showModal({}, {bodyText:'You must be logged in to save to the Library.'});
                    return;
                }

                var container = $localStorage.builderBundles[$scope.currentBundleIndex];

                if (container.author && container.author.length > 0) {
                    //There's an auther so make sure this author is one of them. Allow..
                    if (user.email !== container.author[0].display) {
                        modalService.showModal({}, {bodyText:'Only the author of the scenario can update it to the Library.'});
                        return;
                    }

                }

                builderSvc.saveToLibrary($localStorage.builderBundles[$scope.currentBundleIndex],$scope.user).then(
                    function (data) {

                        $scope.selectedContainer.isDirty = false;
                        modalService.showModal({}, {bodyText:'The set has been updated in the Library. You can continue editing.'});
                        refreshLibrary();

                    },function (err) {
                        modalService.showModal({}, {bodyText:'Sorry, there was an error updating the library:' + angular.toJson(err)})
                        console.log(err)
                    }
                );

            };

            //---------

            $scope.selectBundle = function(inx){
                delete $scope.resourcesFromServer;
                $scope.currentBundleIndex = inx;

                $scope.selectedContainer = $localStorage.builderBundles[$scope.currentBundleIndex];
                createDownLoad($scope.selectedContainer)

                builderSvc.setAllResourcesThisSet($localStorage.builderBundles[$scope.currentBundleIndex].bundle);
                $scope.currentPatient = builderSvc.getPatientResource();

                getExistingData($scope.currentPatient)



                makeGraph();
                delete $scope.currentResource;
                isaDocument();      //determine if this bundle is a document (has a Composition resource)
                $rootScope.$emit('newSet',$scope.selectedContainer.bundle);
            }

            $scope.displayMode = 'view';    //options 'new', 'view'
            $scope.setDisplayMode = function(mode) {
                $scope.displayMode = mode;
            }

            //displays the data entry screen for adding a datatype value
            $scope.addValueForDt = function(hashPath,dt) {

                //if this is not adding to the root, check that there is a branch selected...
                var ar = hashPath.path.split('.');
                if (ar.length > 2 &&  $scope.existingElements.list.length == 0) {

                    if (ar.length ==3 && hashPath.elementInfo.isExtension) {
                        //this is a hack to allow extensions to be added to properties immediately off the root...
                    } else {

                        //if the parent is not multiple, then it can go through (Encounter.hospitilization)
                        var parentPath = ar;
                        var parentName = parentPath.pop();
                        var parentInfo = builderSvc.getEDInfoForPath(parentPath.join('.'));
                        if (parentInfo.isMultiple) {
                            //we need to create a branch to add this to...

                            //todo this assumes that is off the root - FIX !!!
                            var vo = builderSvc.makeInsertPoint($scope.currentResource,hashPath.path);//,insertPoint);
                            //vo.insertPoint[parentPath[parentPath.length-1]] = {};
                            /* TODO DON'T REMOVE YET!!
                            var msg = 'Please create a reference to a resource on this branch. ' +
                                'After that, you can add other datatypes and create new branches as desired';
                            modalService.showModal({}, {bodyText:msg});
                            return;
                            */
                        }
                    }
                }

                //set the insert point based on the path selected (if any)
                var insertPoint = $scope.currentResource;

                //if the immediate predecessor is a BBE with a multiplecity of 1, then adjust the insert point (careplan.activity.detail)
                var ar = hashPath.path.split('.');

                //if we're not inserting onto the root, then we need to set the insert point based on the path & selected index
                if (ar.length > 2) {

                    if ($scope.input.selectedExistingElement > -1) {
                        insertPoint = $scope.existingElements.list[$scope.input.selectedExistingElement];
                    }

                    //this tests for an insert point not on the root, where the immediate predecessor is a BBE with a multiplecity of 1 (careplan.activity.detail)
                    ar.pop();       //pop off the segment we are inserting at
                    var testPath = ar.join('.');
                    var info = builderSvc.getEDInfoForPath(testPath);

                    var segmentName = ar[ar.length-1];
                    if (info.isBBE) {

                        if (! info.isMultiple) {
                            //var segmentName = ar[ar.length-1];
                            if (insertPoint[segmentName]) {
                                insertPoint = insertPoint[segmentName]
                            } else {
                                insertPoint[segmentName] = {};
                                insertPoint = insertPoint[segmentName]
                            }
                        } else {
                            //eg Organization.contact
                            if (insertPoint[segmentName]) {
                                insertPoint = insertPoint[segmentName][0]
                            }
                        }




                    }

                    //if this is an extension, then the insertPoint moves down one...
                    //todo - not that happy with this...
                    if (hashPath.elementInfo.isExtension) {

                        if (angular.isObject(insertPoint)) {
                            if (insertPoint[segmentName]) {
                                insertPoint = insertPoint[segmentName]
                            } else {
                                insertPoint[segmentName] = {};
                                insertPoint = insertPoint[segmentName]
                            }
                        } else {

                        }


                    }


                }

                if ($scope.supportedDt.indexOf(dt) > -1) {
                    $scope.selectedContainer.isDirty = true;
                    delete $scope.input.dt;
                    $scope.resetValidation();

                    $uibModal.open({
                        templateUrl: 'modalTemplates/addPropertyInBuilder.html',
                        size: 'lg',
                        controller: 'addPropertyInBuilderCtrl',
                        resolve : {
                            dataType: function () {          //the default config
                                return dt;
                            },
                            hashPath: function () {          //the default config
                                return hashPath;
                            },
                            insertPoint: function () {          //the point where the insert is to occur ...
                                return insertPoint
                                //return $scope.currentResource;
                            },
                            vsDetails: function () {          //the default config
                                return $scope.vsDetails;
                            },
                            expandedValueSet: function () {          //the default config
                                return $scope.expandedValueSet;
                            }
                        }
                    }).result.then(function () {
                        drawResourceTree($scope.currentResource);   //don't need to update the graph...

                    })

                }


            };
            //adds a new value to a property

            //edit the resource text
            $scope.editResource = function(resource){
                $scope.selectedContainer.isDirty = true;
                var vo = builderSvc.splitNarrative(resource.text.div)  //return manual & generated text


                var modalOptions = {
                    closeButtonText: "Cancel",
                    actionButtonText: 'Save',
                    headerText: 'Edit resource text',
                    bodyText: 'Current text:',
                    userText :   vo.manual          //pass in the manual text only...
                };



                modalService.showModal({}, modalOptions).then(
                    function (result) {

                        if (result.userText) {
                            //create the text and add the manual marker (to separate this from generated text)
                            var narrative = builderSvc.addGeneratedText(result.userText,vo.generated);

                            resource.text.div = narrative; //$filter('addTextDiv')(narrative);

                            //resource.text.div = $filter('addTextDiv')(result.userText + builderSvc.getManualMarker() + vo.generated);
                            $rootScope.$emit('resourceEdited',resource);
                            makeGraph();
                        }


                    }
                );



            }

            //remove a bundle set...
            $scope.deleteBundle = function(inx) {



                var modalOptions = {
                    closeButtonText: "No, I changed my mind",
                    actionButtonText: 'Yes, please remove',
                    headerText: 'Remove resource set',
                    bodyText: 'Are you sure you wish to remove this scenario from the local cache?'
                };

                if ($scope.selectedContainer.isDirty) {
                    modalOptions.bodyText += " (There are unsaved changes you know...)"
                }


                modalService.showModal({}, modalOptions).then(
                    function () {
                        $rootScope.$emit('newSet');     //clears the current section...

                        delete $scope.currentResource;
                        $localStorage.builderBundles.splice(inx,1)   //delete the bundle
                        $scope.currentBundleIndex = 0; //set the current bundle to the first (default) one
                        if ($localStorage.builderBundles.length == 0) {
                            //no bundles left
                            $localStorage.builderBundles = []
                           // delete $scope.resourcesBundle;
                            delete $scope.selectedContainer;
                        } else {
                            //$scope.resourcesBundle = $localStorage.builderBundles[$scope.currentBundleIndex].bundle;
                            $scope.selectedContainer = $localStorage.builderBundles[$scope.currentBundleIndex];
                            makeGraph();
                        }


                        refreshLibrary();       //so the download link is disabled...


                    }
                );





                //$localStorage.builderBundle = {resourceType:'Bundle',entry:[]}//
                //$scope.resourcesBundle = $localStorage.builderBundle


            }

            $scope.removeResource = function(resource) {
                //remove this resource from the bundle
                $scope.selectedContainer.isDirty = true;

                var modalOptions = {
                    closeButtonText: "No, don't remove",
                    actionButtonText: 'Yes, please remove',
                    headerText: 'Remove resource',
                    bodyText: 'Are you sure you want to remove this resource (Any references to it will NOT be removed)'
                };

                modalService.showModal({}, modalOptions).then(
                    function (result) {
                        var inx = -1;
                        for (var i=0; i < $scope.selectedContainer.bundle.entry.length; i++) {
                        //for (var i=0; i < $scope.resourcesBundle.entry.length; i++) {
                            //var r = $scope.resourcesBundle.entry[i].resource;
                            var r = $scope.selectedContainer.bundle.entry[i].resource;
                            if (r.resourceType == resource.resourceType && r.id == resource.id) {
                                inx = i;
                                break;
                            }
                        }
                        if (inx > -1) {
                           // $scope.resourcesBundle.entry.splice(inx,1);
                            $scope.selectedContainer.bundle.entry.splice(inx,1);

                            makeGraph();
                            delete $scope.currentResource;
                            isaDocument();      //may not still be a document...
                        }

                    }
                );


            };

            $scope.hideOthers = function() {
                makeGraph($scope.currentResource)
            }

            $scope.showAllInGraph = function(){
                makeGraph()
            }

            //generate the graph of resources and references between them
            makeGraph = function(centralResource) {
                //if ($scope.resourcesBundle) {

                $scope.filteredGraphView = false;
                if (centralResource) {
                    $scope.filteredGraphView = true;
                }

                if ($scope.selectedContainer && $scope.selectedContainer.bundle) {
                    var vo = builderSvc.makeGraph($scope.selectedContainer.bundle,centralResource)   //todo - may not be the right place...

                    $scope.allReferences = vo.allReferences;                //all references in the entire set.

                    var container = document.getElementById('resourceGraph');
                    var options = {
                        physics: {
                            enabled: true,
                            barnesHut: {
                                gravitationalConstant: -10000,
                            }
                        }
                    };
                    $scope.chart = new vis.Network(container, vo.graphData, options);
                    $scope.chart.on("click", function (obj) {



                        var nodeId = obj.nodes[0];  //get the first node


                            var node = vo.graphData.nodes.get(nodeId);

                            if (node.cf) {
                                $scope.selectResource(node.cf.resource)
                            } else {
                                var edgeId = obj.edges[0];
                                var edge = vo.graphData.edges.get(edgeId);

                                $scope.selectReference(edge,vo.nodes)
                            }





                        $scope.$digest();


                    });
                }



            };

            $timeout(function(){
                makeGraph()
            }, 1000);

            $scope.removeReferenceDEP = function(ref) {


                alert("Sorry, there's a bug removing references - working on it...")
                return;


                $scope.selectedContainer.isDirty = true;
                var path = ref.path;
                var target = ref.targ;
                builderSvc.removeReferenceAtPath($scope.currentResource,path,ref.index)
                makeGraph();    //this will update the list of all paths in this model...
                var url = $scope.currentResource.resourceType+'/'+$scope.currentResource.id;
                $scope.currentResourceRefs = builderSvc.getSrcTargReferences(url)
                $scope.generatedHtml = builderSvc.makeDocumentText($scope.compositionResource,$scope.selectedContainer.bundle); //update the generated document


            }

            $scope.redrawChart = function(){
                //$scope.chart.fit();
                $timeout(function(){
                    if ($scope.chart) {
                        $scope.chart.fit();

                    }

                },1000)

            }

            $scope.viewVS = function(binding) {

                var uri;
                if (binding.valueSetReference && binding.valueSetReference.reference) {
                    uri = binding.valueSetReference.reference
                } else if (binding.valueSetUri) {
                    uri = binding.valueSetUri
                }


                if (uri) {
                    GetDataFromServer.getValueSet(uri).then(
                        function(vs) {

                            $scope.showVSBrowserDialog.open(vs);

                        },
                        function(err) {
                            modalService.showModal({}, {bodyText:err});

                        }
                    ).finally (function(){
                        $scope.showWaiting = false;
                    });
                } else {
                    alert('Unable to locate ValueSet')
                }




            };

            //NOT WORKING
            $scope.removeReferenceDEP = function(fromResource,toResource,path) {

                modalService.showModal({}, {bodyText:'Sorry, still working on this. Removing either of the resources will remove the reference. (A bit brutal I admit)'});
                return

                //remove a reference from a resource. currently has limitations...
                if (path.indexOf('.') > 1) {
                    modalService.showModal({}, {bodyText:'Sorry, at the moment I can only remove references from the root'});
                    return;
                }

                var reference = fromResource.resourceType + '/' + fromResource.id;
                var resource = builderSvc.resourceFromReference(reference)
                delete resource[path];
                $scope.selectResource(resource,function(){
                    $scope.waiting = false;
                    makeGraph();
                    drawResourceTree(resource);
                    isaDocument();      //determine if this bundle is a document (has a Composition resource)

                    //$rootScope.$emit('addResource',resource);

                });



            };

            $scope.selectReference = function(edge,nodes) {
                $scope.currentReference = {edge:edge};
                var fromNode = findNode(nodes,edge.from);

                $scope.currentReference.from = fromNode;// builderSvc.resourceFromReference();//  fromNode;
                $scope.currentReference.fromPath = edge.label; //fromNode.cf.resource.resourceType + '.' + edge.label; //todo needs better validtion
                $scope.currentReference.to = findNode(nodes,edge.to);
                delete $scope.currentResource;

                function findNode(nodes,id) {
                    for (var i=0; i< nodes.length; i++) {
                        var node = nodes[i]
                        if (node.id == id) {
                            return node;
                            break;
                        }
                    }
                }

            };

            //if there is a cb (callback property) then execute it after retrieving the SD (as it is generally used for a new resource to add the patient reference)
            $scope.selectResource = function(entry,cb) {
                //right now, the 'entry' can be an entry or a resource (todo which I must fix!)
                var resource = entry
                if (entry.resource) {
                    resource = entry.resource;
                }

                builderSvc.setCurrentResource(resource);    //set the current resource in the service

                $scope.displayMode = 'view';

                delete $scope.hashPath;
                delete $scope.existingElements;
                delete $scope.expandedValueSet;
                delete $scope.currentElementValue;
                delete $scope.currentReference;


                $scope.currentResource = resource;      //in theory we could use currentEntry...
                $scope.currentEntry = entry;            //needed for validation

                drawResourceTree(resource)

                $scope.waiting = true;
                builderSvc.getSD(resource).then(

                    function(SD) {

                        processSD(SD,resource);

                        if (cb) {
                            cb();
                        }


                    },
                    function (err) {
                        modalService.showModal({}, {bodyText:angular.toJson(err)});

                    }
                ).finally(function(){
                    $scope.waiting = false;
                })


            };

            //----------------
            //process a StructureDefinition file -
            function processSD(SD,resource){
               // if (cb) {
                    builderSvc.setPatient(resource,SD);     //set the patient reference (if there is a patient or subject property)
               // }

                //set up the references after setting the patient...
                var url = resource.resourceType+'/'+resource.id;
                $scope.currentResourceRefs = builderSvc.getSrcTargReferences(url)


                profileCreatorSvc.makeProfileDisplayFromProfile(SD).then(
                    function(vo) {


                        $('#SDtreeView').jstree('destroy');
                        $('#SDtreeView').jstree(
                            {'core': {'multiple': false, 'data': vo.treeData, 'themes': {name: 'proton', responsive: true}}}
                        ).on('select_node.jstree', function (e, data) {

                            $scope.hashReferences = {}      //a hash of type vs possible resources for that type
                            delete $scope.hashPath;
                            delete $scope.expandedValueSet;
                            delete $scope.currentElementValue;

                            $scope.input.showCodeValues = false;

                            if (data.node && data.node.data && data.node.data.ed) {

                                var path = data.node.data.ed.path;

                                $scope.possibleReferences = [];
                                var ed = data.node.data.ed;

                                $scope.currentElementValue = builderSvc.getValueForPath($scope.currentResource,path);

                                //existing branches that could allow an element on this path...
                                $scope.existingElements = builderSvc.analyseInstanceForPath($scope.currentResource, path)


                                //get the type information
                                if (ed.type) {
                                    $scope.hashPath = {path: ed.path};
                                    $scope.hashPath.ed = ed;
                                    //$scope.hashPath.max = ed.max;
                                    $scope.hashPath.definition = ed.definition;
                                    $scope.hashPath.comments = ed.comments;
                                    $scope.hashPath.elementInfo = builderSvc.getEDInfoForPath(ed.path);


                                    //get the ValueSet if there is one bound...
                                    var urlToValueSet;
                                    if ($scope.hashPath.ed.binding && $scope.hashPath.ed.binding) {
                                        //there is a binding - is it a reference or a uri? (The core types use reference - but it seems tobe a uri)
                                        if ($scope.hashPath.ed.binding && $scope.hashPath.ed.binding.valueSetReference &&
                                            $scope.hashPath.ed.binding.valueSetReference.reference) {
                                            urlToValueSet = $scope.hashPath.ed.binding.valueSetReference.reference;
                                        }
                                        if ($scope.hashPath.ed.binding && $scope.hashPath.ed.binding.valueSetUri) {
                                            urlToValueSet = $scope.hashPath.ed.binding && $scope.hashPath.ed.binding.valueSetUri;
                                        }
                                    }



                                    //if there's a ValueSet then get the details, and display the contents if small (ie is a list)
                                    if (urlToValueSet) {


                                        Utilities.getValueSetIdFromRegistry(urlToValueSet,function(vsDetails) {
                                            $scope.vsDetails = vsDetails;  //vsDetails = {id: type: resource: }

                                            if ($scope.vsDetails) {
                                                if ($scope.vsDetails.type == 'list' || ed.type[0].code == 'code') {
                                                    //this has been recognized as a VS that has only a small number of options...
                                                    GetDataFromServer.getExpandedValueSet($scope.vsDetails.id).then(
                                                        function (vs) {
                                                            $scope.expandedValueSet = vs;

                                                        }, function (err) {
                                                            alert(err + ' expanding ValueSet')
                                                        }
                                                    )
                                                }
                                            }

                                        })
                                    }


                                    ed.type.forEach(function(typ){

                                        //is this a resource reference?
                                        var targetProfile = typ.profile || typ.targetProfile;       //different in STU2 & 3
                                        if (typ.code == 'Reference' && targetProfile) {
                                            //get all the resources of this type  (that are not already referenced by this element
                                            $scope.hashPath.isReference = true;


                                            var type = $filter('getLogicalID')(targetProfile);


                                            var ar = builderSvc.getResourcesOfType(type,$scope.selectedContainer.bundle);

                                            if (ar.length > 0) {
                                                ar.forEach(function(resource){
                                                    var reference = builderSvc.referenceFromResource(resource); //get the reference (type/id)

                                                    //search all the references for ones from this path. Don't include them in the list
                                                    //$scope.allReferences created when the graph is built...
                                                    var alreadyReferenced = false;


                                                    $scope.currentResourceRefs.src.forEach(function(item){
                                                        if (item.path == path && item.targ == reference) {
                                                            alreadyReferenced = true;
                                                        }
                                                    });

                                                   //todo - trouble is that the search is by resource type not instance... if (! alreadyReferenced) {
                                                        type = resource.resourceType;   //allows for Reference
                                                        $scope.hashReferences[type] = $scope.hashReferences[type] || []
                                                        $scope.hashReferences[type].push(resource);
                                                    //}

                                                })
                                            }

                                        } else {
                                            //if not a refernece, then peform the analysis of the instance - potentially rejecting the addition...

                                            //analyse the path. if it has an ancestor of type backbone element that is multiple, then show the current entries in the instance
                                            //returns {list: modelPoint:}
                                            //$scope.existingElements = builderSvc.analyseInstanceForPath($scope.currentResource, path)

                                            if ($scope.existingElements.list.length > 0) {
                                                //leave the selectedExistingElement alone unless it is greater than the length.

                                                if ($scope.existingElements.list.length == 1) {
                                                    $scope.input.selectedExistingElement = 0;   //select it
                                                } else if ($scope.input.selectedExistingElement >= $scope.existingElements.list.length) {
                                                    $scope.input.selectedExistingElement = 0;   //select the first
                                                }

                                            } else {
                                                //for the moment, use the resourcing linking functionity to set up the child nodes. todo fix
                                                // var msg = 'Please create a reference to a resource on this branch. After that, you can add other datatypes and create new branches as desired';
                                                //modalService.showModal({}, {bodyText:msg});
                                                //return;
                                            }


                                        }

                                    })


                                }


                            }

                            $scope.$digest();


                        })

                    }
                )

                var objReferences = {}      //a hash of path vs possible resources for that path

                var references = builderSvc.getReferences(SD); //a list of all possible references by path

                $scope.bbNodes = [];        //backbone nodes to add
                $scope.l2Nodes = {};        //a hash of nodes off the root that can have refernces. todo: genaralize for more levels

                references.forEach(function(ref){
                    var path = ref.path
                    //now to determine if there is an object (or array) at the 'parent' of each node. If there
                    //is, then add it to the list of potential resources to link to. If not, then create
                    //an option that allows the user to add that parent
                    var ar = path.split('.');

                    if (ar.length == 2 ) {   //|| resource[parentPath]
                        //so this is a reference off the root
                        objReferences[path] = objReferences[path] || {resource:[],ref:ref}
                        //now find all existing resources with this type
                        var type = $filter('getLogicalID')(ref.profile);

                        var ar = builderSvc.getResourcesOfType(type,$scope.selectedContainer.bundle);
                        //var ar = builderSvc.getResourcesOfType(type,$scope.resourcesBundle);
                        if (ar.length > 0) {
                            ar.forEach(function(resource){

                                //objReferences[path].ref = ref;
                                objReferences[path].resource.push(resource);
                            })
                        }
                    } else {
                        if (ar.length == 3) {
                            //a node off the root...
                            var segmentName = ar[1];    //eg 'entry' in list
                            $scope.l2Nodes[segmentName] = $scope.l2Nodes[segmentName] || [];
                            var el = {path:path,name:ar[2]};    //the element that can be a reference

                            //we need to find out if the parent node for a reference at this path can repeat...
                            var parentPath = ar[0]+'.'+ar[1];       //I don;t really like this...

                            var info = builderSvc.getEDInfoForPath(parentPath);
                            el.info = info

                            $scope.l2Nodes[segmentName].push(el)

                            $scope.bbNodes.push({level:2,path:path});
                        }
                        //so this is a reference to an insert point where the parent does not yet exist

                    }





                })


                $scope.objReferences = objReferences;
               // if (cb) {
                  //  cb();
               // }


            }
            //---------------------

            $scope.addBBE = function(){
                //add a new BackBone element for the selected node

                //the parent must have already been created...
                if ($scope.existingElements.modelPoint && angular.isArray($scope.existingElements.modelPoint)) {
                    //this is the 'parent' root for the currently selected element...
                    $scope.existingElements.modelPoint.push({});        //add a new element to the resource instance...
                    $scope.existingElements.list = $scope.existingElements.modelPoint;      //so the list is still pointing to the instance
                    $scope.input.selectedExistingElement = $scope.existingElements.list.length -1;

                } else {
                    alert('cannot add new branch');
                }

            }

            $scope.linkToResource = function(pth,resource,ref){

                if (pth == 'Composition.section.entry') {
                    modalService.showModal({}, {bodyText:'Use the special Document controls (middle panel, Document tab) to add sections to the composition'});
                    return;
                }

                $scope.selectedContainer.isDirty = true;

                var insertPoint;        //if we want to set the insert point...

                //set the insert point based on the path selected (if any)
                 //var insertPoint = $scope.currentResource;
                 if ($scope.input.selectedExistingElement > -1) {
                    insertPoint = $scope.existingElements.list[$scope.input.selectedExistingElement];
                 }

                builderSvc.insertReferenceAtPath($scope.currentResource,pth,resource,insertPoint)

                makeGraph();    //this will update the list of all paths in this model...
                drawResourceTree($scope.currentResource);
                $scope.generatedHtml = builderSvc.makeDocumentText($scope.compositionResource,$scope.selectedContainer.bundle); //update the generated document
                var url = $scope.currentResource.resourceType+'/'+$scope.currentResource.id;
                $scope.currentResourceRefs = builderSvc.getSrcTargReferences(url)



                //now remove the reference from the list of possibilities...


                var type = resource.resourceType;   //allows for Reference
                var pos = -1;
                $scope.hashReferences[type].forEach(function(res,inx){
                    if (res.id == resource.id) {
                        pos = inx;
                    }
                })

                if (pos > -1) {
                    $scope.hashReferences[type].splice(pos,1);
                    // if ()
                }




            }

            $scope.addNewResource = function(type) {

                if (type == 'Composition') {
                    if ($scope.isaDocument) {
                        modalService.showModal({}, {bodyText:'There is already a Composition in this set - and there can only be one.'});
                        $scope.displayMode = 'view';
                        return;
                    }

                }

                $scope.waiting = true;

                $scope.selectedContainer.isDirty = true;

                var resource = {resourceType : type};
                resource.id = idPrefix+new Date().getTime();
                $scope.input.text = $scope.input.text || "";

                resource.text = {status:'generated',div:  $filter('addTextDiv')($scope.input.text + builderSvc.getManualMarker())};



                builderSvc.addResourceToAllResources(resource)

                $scope.selectedContainer.bundle.entry.push({resource:resource});
                //$scope.resourcesBundle.entry.push({resource:resource});

                $scope.selectedContainer.bundle.entry.sort(function(a,b){
                //$scope.resourcesBundle.entry.sort(function(a,b){
                    if (a.resource.resourceType > b.resource.resourceType) {
                        return 1
                    } else {
                        return -1
                    }
                })

                $scope.displayMode = 'view';


                $scope.selectResource(resource,function(){
                    $scope.waiting = false;
                    makeGraph();
                    drawResourceTree(resource);

                    isaDocument();      //determine if this bundle is a document (has a Composition resource)

                    $rootScope.$emit('addResource',resource);

                });       //select the resource, indicating that it is a new resource...



            };

            $scope.newTypeSelected = function(item) {
                $scope.waiting = true;
                delete $scope.input.text;
                var type = item.name;
                var uri = "http://hl7.org/fhir/StructureDefinition/"+type;
                GetDataFromServer.findConformanceResourceByUri(uri).then(
                    function(data) {

                        $scope.currentType = data;
                        $scope.references = builderSvc.getReferences($scope.currentType)


                    },
                    function(err) {
                        modalService.showModal({}, {bodyText:"Sorry, I couldn't find the profile for the '"+type+"' resource on the Conformance Server ("+appConfigSvc.getCurrentConformanceServer().name+")"});
                        $scope.setDisplayMode('view')
                    }
                ).finally(function(){
                    $scope.waiting = false;
                })

            }


            function drawResourceTree(resource) {

                //make a copy to hide all the $$ properties that angular adds...
                var r = angular.copy(resource);
                var newResource =  angular.fromJson(angular.toJson(r));


                var treeData = resourceCreatorSvc.buildResourceTree(newResource);

                //show the tree structure of this resource version
                $('#builderResourceTree').jstree('destroy');
                $('#builderResourceTree').jstree(
                    {'core': {'multiple': false, 'data': treeData, 'themes': {name: 'proton', responsive: true}}}
                ).on('select_node.jstree', function (e, data) {
                    console.log(data.node.data)
                    delete $scope.displayResourceTreeDeletePath;
                    if (data.node.data.level == 1) {
                        //a top level node that can be deleted
                        $scope.displayResourceTreeDeletePath = data.node.data.key;
                    }

                    $scope.$digest();
                })

            }

            $scope.canDeletePath = function() {
                if (!$scope.displayResourceTreeDeletePath) {
                    return false;
                }

                if (['id','resourceType','text'].indexOf($scope.displayResourceTreeDeletePath) == -1) {
                    return true;
                }
                return false;
            }

            $scope.removeResourceNode = function(path){
                //can remove top level nodes only...  (for now)
                console.log(path)

                var modalOptions = {
                    closeButtonText: "No, I changed my mind",
                    actionButtonText: 'Yes, please remove it',
                    headerText: 'Remove element',
                    bodyText: 'Are you sure you wish to delete this element. '
                };

                modalService.showModal({}, modalOptions).then(
                    function (){
                        delete $scope.currentResource[path]
                        drawResourceTree($scope.currentResource)
                        makeGraph();    //in case it was a reference that was removed...

                    }
                );




            };

            RenderProfileSvc.getAllStandardResourceTypes().then(
                function(lst) {
                    $scope.resources = lst



                }
            );

            $scope.showVSBrowserDialog = {};




            //------- select a profile --------
            $scope.showFindProfileDialog = {};
            $scope.findProfile = function(cheat) {

                if (cheat) {
                    GetDataFromServer.adHocFHIRQuery("http://fhirtest.uhn.ca/baseDstu3/StructureDefinition/dhtest1profile").then(
                        function(data) {

                            $scope.selectedProfileFromDialog(data.data)

                        }
                    )
                } else {
                    $scope.showFindProfileDialog.open();
                }
            };

            $scope.selectedProfileFromDialog = function (profile) {

                builderSvc.makeLogicalModelFromSD(profile).then(
                    function (lm) {

                        selectLogicalModal(lm,profile.url)


                    },
                    function(vo) {

                        //if cannot locate an extension. returns the error and the incomplete LM
                        selectLogicalModal(vo.lm,profile.url)
                    }
                )

            };




            //----- Logical model support

            function selectLogicalModal(lm,profileUrl) {
                var type = lm.snapshot.element[0].path;
                $scope.selectedContainer.isDirty = true;
                var resource = {resourceType : type};
                resource.id = idPrefix+new Date().getTime();
                $scope.input.text = $scope.input.text || "";
                resource.text = {status:'generated',div:  $filter('addTextDiv')($scope.input.text + builderSvc.getManualMarker())};
                resource.meta = {profile:[lm.url]};
                resource.implicitRules = lm.implicitRules;


                //is this a lm based on a core resource? If so, add an extension to the resource so it can be a reference target...
                var baseTypeForModel = appConfigSvc.config().standardExtensionUrl.baseTypeForModel;
                var extensionValue = Utilities.getSingleExtensionValue(lm,baseTypeForModel);
                if (extensionValue && extensionValue.valueString) {
                    resource.extension = [extensionValue]
                   // Utilities.addExtensionOnceWithReplace(resource,baseTypeForModel,extensionValue)
                }


                builderSvc.addResourceToAllResources(resource)
                builderSvc.addSDtoCache(lm)

                var item = {resource:resource};
                if (profileUrl) {
                    item.isProfile=true
                    item.profile = profileUrl;
                } else {
                    item.isLogical = true
                }
                $scope.selectedContainer.bundle.entry.push(item);
                $scope.selectedContainer.bundle.entry.sort(function(a,b){
                    //$scope.resourcesBundle.entry.sort(function(a,b){
                    if (a.resource.resourceType > b.resource.resourceType) {
                        return 1
                    } else {
                        return -1
                    }
                })
                $scope.displayMode = 'view';
                $scope.selectResource(resource,function(){
                    $scope.waiting = false;
                    makeGraph();
                    drawResourceTree(resource);

                    isaDocument();      //determine if this bundle is a document (has a Composition resource)

                    $rootScope.$emit('addResource',resource);

                });
            }

            //load all the logical models. This won't scale...
            logicalModelSvc.loadAllModels(appConfigSvc.getCurrentConformanceServer().url).then(
                function (bundle) {
                    $scope.allLogicalModelsBundle = bundle
                    $scope.bundleLogicalModels = angular.copy($scope.allLogicalModelsBundle)

                }, function (err) {
                    alert(err)
                }
            );


            //used to provide the filtering capability...
            $scope.filterModelList = function(filter) {
                filter = filter.toLowerCase();
                $scope.bundleLogicalModels = {entry:[]};   //a mnimal bundle
                $scope.allLogicalModelsBundle.entry.forEach(function(entry){
                    if (entry.resource.id.toLowerCase().indexOf(filter) > -1) {
                        $scope.bundleLogicalModels.entry.push(entry);
                    }
                })
            };


            $scope.selectLogicalModelFromList = function(entry,index){
                var lm = entry.resource;
                lm.implicitRules = 'isLogicalModel'





                selectLogicalModal(lm)
            }


        });