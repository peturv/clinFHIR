
angular.module("sampleApp")
    .controller('profileDiffCtrl',
        function ($scope,$q,$http,profileDiffSvc,$uibModal,logicalModelSvc,appConfigSvc,RenderProfileSvc,
                  Utilities,GetDataFromServer,profileCreatorSvc) {

            $scope.input = {};
            $scope.appConfigSvc = appConfigSvc;

            $scope.history = [];        //

            function addToHistory(type,resource) {
                $scope.history.push({type:type,resource:resource})
                console.log($scope.history);
            }

            function popHistory() {
                if (history.length > 0) {
                    var hx = history.pop();
                    switch (hx.type) {
                        case 'profile' :

                            break;
                    }
                }
            }


            function clearRightPane(){
                delete $scope.currentIG;
                delete $scope.selectedItemType ;
                delete $scope.selectedItem;
                delete $scope.profileReport;

            }

            //used when selecting a single profile...
            RenderProfileSvc.getAllStandardResourceTypes().then(
                function(lst) {
                    $scope.allResourceTypes = lst
                }
            );
            
            $scope.findAdhHocProfile = function (baseType) {
                var svr =  appConfigSvc.getCurrentConformanceServer();
                var searchString = appConfigSvc.getCurrentConformanceServer().url + "StructureDefinition?";



                if (svr.version == 3) {
                    searchString += "kind=resource&base=http://hl7.org/fhir/StructureDefinition/"+$scope.results.profileType.name
                } else {
                    searchString += "kind=resource&type="+baseType.name
                }

                console.log(searchString)
                $scope.waiting = true;
                $http.get(searchString).then(
                    function(data) {
                        $scope.profilesOnBaseType = data.data;
                        console.log($scope.profilesOnBaseType)

                    },
                    function(err){
                        console.log(err)
                    }
                ).finally(function () {
                    $scope.waiting = false;
                });

            }

            $scope.selectAdhHocProfile = function(SD) {
                $scope.selectedItemType = 'profile';
                setupProfile(SD)
            };
            
            //load the IG's that describe 'collections' of conformance aritfacts - like CareConnect & Argonaut
            var url = appConfigSvc.getCurrentConformanceServer().url + "ImplementationGuide";
            $http.get(url).then(
                function(data) {
                    $scope.listOfIG = []
                    if (data.data && data.data.entry) {
                        data.data.entry.forEach(function (entry) {
                            $scope.listOfIG.push(entry.resource)
                        })
                    }
                    $scope.input.selIG = $scope.listOfIG[0]
                },
                function(err){
                    console.log(err)
                }
            );

            //note that we're using an IG to hold all the resources in this collection
            $scope.selectIG = function(IG){
                clearRightPane();
                $scope.currentIG=IG;     //the List the holds this collection
                console.log(IG)
                //now pull out the various artifacts into an easy to use object
                $scope.artifacts = {}
                $scope.currentIG.package.forEach(function (package) {
                    package.resource.forEach(function (resource) {
                        var purpose = resource.purpose || resource.acronym;     //<<< todo - 'purpose' was removed in R3...
                        $scope.artifacts[purpose] = $scope.artifacts[purpose] || []
                        $scope.artifacts[purpose].push({url:resource.sourceReference.reference, description:resource.description})

                    })

                })
            };

            //-------- functions and prperties to enable the valueset viewer
            $scope.showVSBrowserDialog = {};
            $scope.showVSBrowser = function(vs) {
                $scope.showVSBrowserDialog.open(vs);        //the open method defined in the directive...
            };

            $scope.showValueSet = function(uri,type) {
                //treat the reference as lookup in the repo...
                GetDataFromServer.getValueSet(uri).then(
                    function(vs) {

                        $scope.showVSBrowserDialog.open(vs);

                    }, function(err) {
                        alert(err)
                    }
                ).finally (function(){
                    $scope.showWaiting = false;
                });
            };





            //select an extension from within a profile...
            $scope.selectExtensionFromProfile = function (itemExtension) {
                console.log(itemExtension);

                profileDiffSvc.getSD(itemExtension.url).then(
                    function (SD) {
                        $scope.selectedItemType = 'extension';
                        $scope.selectedExtension = SD;

                        $scope.selectedExtensionAnalysis = Utilities.analyseExtensionDefinition3(SD)
                    }
                )

            }



            //when an item is selected in the accordian for display in the roght pane...
            $scope.selectItem = function(item,type){

                clearRightPane()

               $scope.selectedItemType = type;
                $scope.selectedItem = item;
                /*
               //when called to navigate to a profile...
               if (angular.isArray(item)) {
                   $scope.selectedItem = item[0];
               } else {
                   $scope.selectedItem = item;
               }
*/

               console.log(item)

               if (type == 'terminology') {
                   //really only works for ValueSet at this point...
                   profileDiffSvc.getTerminologyResource(item.url,'ValueSet').then(
                       function (vs) {
                           $scope.selectedValueSet = vs;
                       }, function (err) {
                           console.log(err)
                       }
                   )
               }

               if (type=='extension') {
                    profileDiffSvc.getSD(item.url).then(
                        function (SD) {
                            $scope.selectedExtension = SD;

                            $scope.selectedExtensionAnalysis = Utilities.analyseExtensionDefinition3(SD)
                        }
                    )
               }

               if (type=='profile') {
                   //this is a profiled resource - - an SD
                   // $scope.extensionSelected = true;



                   var url;
                   if (item && item.url) {
                       //called from the sidebar
                       url = item.url
                   } else {
                       //called by clicking a link in the table display (will be an array or string or a string)...
                       if (angular.isArray(item)) {
                           url = item[0]
                       } else {
                           url = item;
                       }
                   }


                   $scope.waiting = true;
                   //console.log($scope.selectedItem.url)
                   GetDataFromServer.findConformanceResourceByUri(url).then(
                       function(SD){
                           console.log(item.url)
                           console.log(SD)
                           setupProfile(SD)
                           addToHistory('profile',SD)

                           /*
                            $scope.selectedSD = SD;


                           //-------- logical model
                           profileCreatorSvc.makeProfileDisplayFromProfile(SD).then(
                               function(vo) {
                                   $('#profileTree1').jstree('destroy');
                                   $('#profileTree1').jstree(
                                       {
                                           'core': {
                                               'multiple': false,
                                               'data': vo.treeData,
                                               'themes': {name: 'proton', responsive: true}
                                           }
                                       }
                                   ).on('select_node.jstree', function (e, data) {
                                       if (data.node) {
                                           console.log(data.node && data.node.data);
                                           $scope.selectedED1 = data.node.data.ed;
                                           $scope.$digest();       //as the event occurred outside of angular...

                                       }
                                   })
                               }
                           )




                           //------- physical model
                           var treeData = logicalModelSvc.createTreeArrayFromSD(SD)
                           $('#profileTree').jstree('destroy');
                           $('#profileTree').jstree(
                               {'core': {'multiple': false, 'data': treeData, 'themes': {name: 'proton', responsive: true}}}
                           ).on('changed.jstree', function (e, data) {
                               //seems to be the node selection event...
                                delete $scope.selectedED;
                               //console.log(data)
                               if (data.node) {
                                   console.log(data.node && data.node.data);
                                   $scope.selectedED = data.node.data.ed;
                                   $scope.$digest();       //as the event occurred outside of angular...

                               }
                           })


                           //------ canonical model
                           //var vo = profileDiffSvc.makeCanonicalObj(SD);

                           profileDiffSvc.makeCanonicalObj(SD).then(
                               function (vo) {
                                   console.log(vo)
                                   $scope.canonical = vo.canonical;
                               },function (err) {
                                   console.log(err)
                               }
                           )

                           //------ report
                           $scope.profileReport = profileDiffSvc.reportOneProfile(SD);

*/

                       }, function (err) {
                           console.log(err)
                       }
                   ).finally(function () {
                       $scope.waiting = false;
                   })



               }


            };

            function setupProfile(SD) {
                $scope.selectedSD = SD;


                //-------- logical model
                profileCreatorSvc.makeProfileDisplayFromProfile(SD).then(
                    function(vo) {
                        $('#profileTree1').jstree('destroy');
                        $('#profileTree1').jstree(
                            {
                                'core': {
                                    'multiple': false,
                                    'data': vo.treeData,
                                    'themes': {name: 'proton', responsive: true}
                                }
                            }
                        ).on('select_node.jstree', function (e, data) {
                            if (data.node) {
                                console.log(data.node && data.node.data);
                                $scope.selectedED1 = data.node.data.ed;
                                $scope.$digest();       //as the event occurred outside of angular...

                            }
                        })
                    }
                )




                //------- physical model
                var treeData = logicalModelSvc.createTreeArrayFromSD(SD)
                $('#profileTree').jstree('destroy');
                $('#profileTree').jstree(
                    {'core': {'multiple': false, 'data': treeData, 'themes': {name: 'proton', responsive: true}}}
                ).on('changed.jstree', function (e, data) {
                    //seems to be the node selection event...
                    delete $scope.selectedED;
                    //console.log(data)
                    if (data.node) {
                        console.log(data.node && data.node.data);
                        $scope.selectedED = data.node.data.ed;
                        $scope.$digest();       //as the event occurred outside of angular...

                    }
                })


                //------ canonical model
                //var vo = profileDiffSvc.makeCanonicalObj(SD);

                profileDiffSvc.makeCanonicalObj(SD).then(
                    function (vo) {
                        console.log(vo)
                        $scope.canonical = vo.canonical;
                    },function (err) {
                        console.log(err)
                    }
                )

                //------ report
                $scope.profileReport = profileDiffSvc.reportOneProfile(SD);

            }


            $scope.showED = function(ed) {
                //console.log(ed)
                $uibModal.open({
                    templateUrl: 'modalTemplates/diffED.html',
                    // size: 'sm',
                    controller: function($scope,ed){
                        $scope.ed = ed;
                       // console.log($scope.ed)
                    },
                    resolve : {
                        ed: function () {          //the default config
                            return ed;
                        }
                    }
                })
            };



    })
