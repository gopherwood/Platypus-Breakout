(function(){
  var platformer = {};

  PBS = this.PBS || {};
  PBS.KIDS = this.PBS.KIDS || {};
  PBS.KIDS.platformer = platformer;

platformer.classes = {};

/*--------------------------------------------------
 *   Game - ../src/js/game.js
 */
/**
# CLASS game
This class is used to create the `platformer.game` object. The `game` object handles loading [[Scene]]s and transitions between scenes. It also accepts external events and passes them on to the current scene.

## Methods
- **constructor** - Creates an object from the game class.
  > @param definition (object) - Collection of settings from config.json.
- **tick** - Called by the CreateJS ticker. This calls tick on the scene.
  > @param deltaT (number) - The time passed since the last tick.
- **loadScene** - Loads a scene. If there's a transition, performs the transition.
  > @param sceneId (string) - The scene to load.
  > @param transition (string) - What type of transition to make. Currently there are: 'fade-to-black' and 'instant'
- **loadNextScene** - Sets the currentScene to the specified scene. Called by loadScene, shouldn't be called on its own.
  > @param sceneId (string) - The scene to load.
- **completeSceneTransition** - Ends the transition and destroys the old scene. Called when the scene effect is finished.
- **addEventListener** - Adding event listeners to the specified element and assigning callback functions.
  > @param element (DOM element) - The element to add the eventListener to.
  > @param event (DOM events) - The event to listen for.
  > @param callback (function) - The function to call when the event occurs.
- **destroy** - Destroys the object so that it's ready to garbage collect.

## Helper Function
- **bindEvent** - Returns a function which takes in an event and calls the callback function passing it the eventId and the event.
  > @param eventId (string) - The id of the event we're binding to.
  > @param callback (function) - The function to call.
*/

platformer.classes.game = (function(){
	var bindEvent = function(eventId, callback){return function(event){callback(eventId, event);};};
	var game      = function (definition){
		this.currentScene = undefined;
		this.tickContent = {
			deltaT: 0,
			count: 0
		};
		this.settings = definition;
		if(document.getElementById(definition.global.rootElement || "root")){
			this.rootElement = document.getElementById(definition.global.rootElement || "root");
		} else {
			this.rootElement = document.createElement('div');
			this.rootElement.id = definition.global.rootElement || "root";
			document.getElementsByTagName('body')[0].appendChild(this.rootElement);
		}
		
		this.loadScene(definition.global.initialScene);
		
		// Send the following events along to the scene to handle as necessary:
		var self = this,
		callback = function(eventId, event){
			self.currentScene.trigger(eventId, event);
		};
		this.bindings = [];
		this.addEventListener(window, 'keydown', callback);
		this.addEventListener(window, 'keyup',   callback);

		// If aspect ratio of game area should be maintained on resizing, create new callback to handle it
		if(definition.global.aspectRatio){
			callback = function(eventId, event){
				var element = self.rootElement;
				var ratio   = definition.global.aspectRatio;
				var newW = window.innerWidth;
				var newH = window.innerHeight;
				if(definition.global.maxWidth && (definition.global.maxWidth < newW)){
					newW = definition.global.maxWidth;
				}
				var bodyRatio = newW / newH;
				if (bodyRatio > ratio)
				{  //Width is too wide
					element.style.height = newH + 'px';
				    newW = newH * ratio;
				    element.style.width = newW + 'px';
				} else {  //Height is too tall
					element.style.width = newW + 'px';
				    newH = newW / ratio;
				    element.style.height = newH + 'px';
				}
				if(definition.global.resizeFont){
					element.style.fontSize = Math.round(newW / 100) + 'px';
				}
				element.style.marginTop = '-' + Math.round(newH / 2) + 'px';
				element.style.marginLeft = '-' + Math.round(newW / 2) + 'px';
				self.currentScene.trigger(eventId, event);
			};
			callback('resize');
		} else if(definition.global.resizeFont) {
			callback = function(eventId, event){
				self.rootElement.style.fontSize = parseInt(window.innerWidth / 100) + 'px';
				self.currentScene.trigger(eventId, event);
			};
			callback('resize');
		}
		this.addEventListener(window, 'orientationchange', callback);
		this.addEventListener(window, 'resize',            callback);
	};
	var proto = game.prototype;
	
	proto.tick = function(deltaT){
		this.tickContent.deltaT = deltaT;
		this.tickContent.count += 1;
		
		if(this.currentScene){
			this.currentScene.trigger('tick', this.tickContent);
		}
	};
	
	proto.loadScene = function(sceneId, transition){
		var self = this;
		this.inTransition = true;
		this.leavingScene = this.currentScene;
		switch(transition){
		case 'fade-to-black':
			var element = document.createElement('div');
			this.rootElement.appendChild(element);
			element.style.width = '100%';
			element.style.height = '100%';
			element.style.position = 'absolute';
			element.style.zIndex = '12';
			element.style.opacity = '0';
			element.style.background = '#000';
			new createjs.Tween(element.style).to({opacity:0}, 500).to({opacity:1}, 500).call(function(t){
				self.loadNextScene(sceneId);
			}).wait(500).to({opacity:0}, 500).call(function(t){
				self.rootElement.removeChild(element);
				element = undefined;
				self.completeSceneTransition();
			});
			break;
		case 'instant':
		default:
			this.loadNextScene(sceneId);
			this.completeSceneTransition();
		}
	};
	
	proto.loadNextScene = function(sceneId){
		this.currentScene = new platformer.classes.scene(this.settings.scenes[sceneId], this.rootElement);
	};
	
	proto.completeSceneTransition = function(){
		this.inTransition = false;
		if(this.leavingScene){
			this.leavingScene.destroy();
			this.leavingScene = false;
		}
	};
	
	proto.addEventListener = function(element, event, callback){
		this.bindings[event] = {element: element, callback: bindEvent(event, callback)};
		element.addEventListener(event, this.bindings[event].callback, true);
	};
	
	proto.destroy = function ()
	{
		for (var binding in this.bindings){
			element.removeEventListener(this.bindings[binding].element, this.bindings[binding].callback, true);
		}
		this.bindings.length = 0;
	};
	
	return game;
})();

/*--------------------------------------------------
 *   Entity - ../src/js/entity.js
 */
/**
# CLASS entity
The Entity object acts as a container for components, facilitating communication between them and other game objects. The entity object serves as the foundation for most of the objects in the Platformer engine.

## Messages

### Local Broadcasts:
- **load** - The entity triggers `load` on itself once all the properties and components have been attached, notifying the components that all their peer components are ready for messages.

## Methods
- **[constructor]** - Returns a new Entity object based on the definitions provided.
  > @param definition (object) - Base definition for the entity, includes properties and components as shown below under "JSON definition".
  > @param instanceDefinition (object) - Specific instance definition including properties that override the base definition properties.
  > @return entity - returns the new entity made up of the provided components. 
- **addComponent** - Attaches the provided component to the entity.
  > @param component (object) - Must be an object that functions as a [[Component]].
  > @return component - Returns the same object that was submitted.
- **removeComponent** - Removes the mentioned component from the entity.
  > @param component (object) - Must be a [[Component]] attached to the entity.
  > @return component|false - Returns the same object that was submitted if removal was successful; otherwise returns false (the component was not found attached to the entity).
- **bind** - Used by components' to bind handler functions to triggered events on the entity. 
  > @param messageId (string) - This is the message for which the component is listening.
  > @param func (function) - This is the function that will be run when the message is triggered.
- **unbind** - Used by components' to unbind handler functions on the entity, typically called when a component is removed from the entity.
  > @param messageId (string) - This is the message the component is currently listening to.
  > @param func (function) - This is the function that was attached to the message.
- **trigger** - This method is used by both internal components and external entities to trigger messages on this entity. When triggered, entity checks through bound handlers to run component functions as appropriate.
  > @param messageId (string) - This is the message to process.
  > @param value (variant) - This is a message object or other value to pass along to component functions.
  > @param debug (boolean) - This flags whether to output message contents and subscriber information to the console during game development. A "value" object parameter (above) will also set this flag if value.debug is set to true.
  > @return integer - The number of handlers for the triggered message: this is useful for determining whether the entity cares about a given message.
- **getMessageIds** - This method returns all the messages that this entity is concerned about.
  > @return Array - An array of strings listing all the messages for which this entity has handlers.
- **destroy** - This method removes all components from the entity.

## JSON Definition:
    {
      "id": "entity-id",
      // "entity-id" becomes `entity.type` once the entity is created.
      
      "components": [
      // This array lists one or more component definition objects
      
        {"type": "example-component"}
        // The component objects must include a "type" property corresponding to a component to load, but may also include additional properties to customize the component in a particular way for this entity.
      ],
      
      "properties": [
      // This array lists properties that will be attached directly to this entity.
      
        "x": 240
        // For example, `x` becomes `entity.x` on the new entity.
      ],
      
      "filters": {
      // Filters are only used by top level entities loaded by the scene and are not used by the entity directly. They determine whether an entity should be loaded on a particular browser according to browser settings.
      
        "includes": ["touch"],
        // Optional. This filter specifies that this entity should be loaded on browsers/devices that support a touch interface. More than one setting can be added to the array.

        "excludes": ["multitouch"]
        // Optional. This filter specifies that this entity should not be loaded on browsers/devices that do not support a multitouch interface. More than one setting can be added to the array.
      }
    }
*/
platformer.classes.entity = (function(){
	var entity = function(definition, instanceDefinition){
		var self             = this,
		index                = undefined,
		componentDefinition  = undefined,
		def                  = definition || {},
		componentDefinitions = def.components || [],
		defaultProperties    = def.properties || {},
		instance             = instanceDefinition || {},
		instanceProperties   = instance.properties || {};
		
		self.components = [];
		self.messages   = [];
		self.loopCheck  = [];
		self.type = def.id;

		for (index in defaultProperties){ // This takes the list of properties in the JSON definition and appends them directly to the object.
			self[index] = defaultProperties[index];
		}
		for (index in instanceProperties){ // This takes the list of options for this particular instance and appends them directly to the object.
			self[index] = instanceProperties[index];
		}
		
		for (index in componentDefinitions){
			componentDefinition = componentDefinitions[index];
			if(platformer.components[componentDefinition.type]){
				self.addComponent(new platformer.components[componentDefinition.type](self, componentDefinition));
			} else {
				console.warn("Component '" + componentDefinition.type + "' is not defined.", componentDefinition);
			}
		}
		self.trigger('load');
	};
	var proto = entity.prototype;
	
	proto.addComponent = function(component){
	    this.components.push(component);
	    return component;
	};
	
	proto.removeComponent = function(component){
	    for (var index in this.components){
		    if(this.components[index] === component){
		    	this.components.splice(index, 1);
		    	component.destroy();
			    return component;
		    }
	    }
	    return false;
	};
	
	proto.bind = function(messageId, func){
		if(!this.messages[messageId]) this.messages[messageId] = [];
		this.messages[messageId].push(func);
	};
	
	proto.unbind = function(messageId, func){
		if(!this.messages[messageId]) this.messages[messageId] = [];
		for (var x in this.messages[messageId]){
			if(this.messages[messageId][x] === func){
				this.messages[messageId].splice(x,1);
				break;
			}
		}
	};
	
	proto.trigger = function(messageId, value, debug){
		var i = 0;
		if(this.debug || debug || (value && value.debug)){
			if(this.messages[messageId] && this.messages[messageId].length){
				console.log('Entity "' + this.type + '": Event "' + messageId + '" has ' + this.messages[messageId].length + ' subscriber' + ((this.messages[messageId].length>1)?'s':'') + '.', value);
			} else {
				console.warn('Entity "' + this.type + '": Event "' + messageId + '" has no subscribers.', value);
			}
		}
		for (i = 0; i < this.loopCheck.length; i++){
			if(this.loopCheck[i] === messageId){
				throw "Endless loop detected for '" + messageId + "'.";
			}
		}
		i = 0;
		this.loopCheck.push(messageId);
		if(this.messages[messageId]){
			for (i = 0; i < this.messages[messageId].length; i++){
				this.messages[messageId][i](value, debug);
			}
		}
		this.loopCheck.length = this.loopCheck.length - 1; 
		return i;
	};
	
	proto.getMessageIds = function(){
		var messageIds = [];
		for (var messageId in this.messages){
			messageIds.push(messageId);
		}
		return messageIds;
	};
	
	proto.destroy = function(){
		for (var x in this.components)
		{
			this.components[x].destroy();
		}
		this.components.length = 0;
	};
	
	return entity;
})();

/*--------------------------------------------------
 *   Scene - ../src/js/scene.js
 */
/**
# CLASS scene
This class is instantiated by [[Game]] and contains one or more entities as layers. Each layer [[Entity]] handles a unique aspect of the scene. For example, one layer might contain the game world, while another layer contains the game interface. Generally there is only a single scene loaded at any given moment.

## Messages

### Child Broadcasts:
- **[Messages specified in definition]** - Listens for messages and on receiving them, re-triggers them on each entity layer.
  > @param message (object) - sends the message object received by the original message.

## Methods
- **[constructor]** - Creates an object from the scene class and passes in a scene definition containing a list of layers to load and a DOM element where the scene will take place.
  > @param definition (object) - Base definition for the scene, including one or more layers with both properties, filters, and components as shown below under "JSON definition".
  > @param rootElement (DOM element) - DOM element where scene displays layers.
  > @return scene - returns the new scene composed of the provided layers.
- **trigger** - This method is used by external objects to trigger messages on the layers as well as internal entities broadcasting messages across the scope of the scene.
  > @param messageId (string) - This is the message to process.
  > @param value (variant) - This is a message object or other value to pass along to component functions.
- **destroy** - This method destroys all the layers in the scene.

## JSON Definition:
    {
      "layers":[
      // Required array listing the entities that should be loaded as scene layers. These can be actual entity JSON definitions as shown in [[Entity]] or references to entities by using the following specification.

        {
          "type": "entity-id",
          // This value maps to an entity definition with a matching "id" value as shown in [[Entity]] and will load that definition.
          
          "properties":{"x": 400}
          // Optional. If properties are passed in this reference, they override the entity definition's properties of the same name.
        }
      ]
    }
*/
platformer.classes.scene = (function(){
	var scene = function(definition, rootElement){
		var layers = definition.layers,
		supportedLayer = true,
		layerDefinition = false,
		properties = false;
		this.rootElement = rootElement;
		this.layers = [];
		for(var layer in layers){
			layerDefinition = layers[layer];
			properties = {rootElement: this.rootElement};
			if (layerDefinition.properties){
				for(i in layerDefinition.properties){
					properties[i] = layerDefinition.properties[i];
				}
			}

			if(layerDefinition.type){ // this layer should be loaded from an entity definition rather than this instance
				layerDefinition = platformer.settings.entities[layerDefinition.type];
			}
			
			supportedLayer = true;
			if(layerDefinition.filter){
				if(layerDefinition.filter.includes){
					supportedLayer = false;
					for(var filter in layerDefinition.filter.includes){
						if(platformer.settings.supports[layerDefinition.filter.includes[filter]]){
							supportedLayer = true;
						}
					}
				}
				if(layerDefinition.filter.excludes){
					for(var filter in layerDefinition.filter.excludes){
						if(platformer.settings.supports[layerDefinition.filter.excludes[filter]]){
							supportedLayer = false;
						}
					}
				}
			}
			if (supportedLayer){
				this.layers.push(new platformer.classes.entity(layerDefinition, {
					properties: properties
				}));
			}
		}
		
		this.time = new Date().getTime();
		this.timeElapsed = {
			name: '',
			time: 0
		};
	};
	var proto = scene.prototype;
	
	proto.trigger = function(eventId, event){
		var time = 0;
		if(eventId === 'tick'){
			time = new Date().getTime();
			this.timeElapsed.name = 'Non-Engine';
			this.timeElapsed.time = time - this.time;
			this.trigger('time-elapsed', this.timeElapsed);
			this.time = time;
		}
		for(var layer in this.layers){
			this.layers[layer].trigger(eventId, event);
		}
		if(eventId === 'tick'){
			time = new Date().getTime();
			this.timeElapsed.name = 'Engine Total';
			this.timeElapsed.time = time - this.time;
			this.trigger('time-elapsed', this.timeElapsed);
			this.time = time;
		}
	};
	
	proto.destroy = function(){
		for(var layer in this.layers){
			this.layers[layer].destroy();
		}
		this.layers.length = 0;
	};
	
	return scene;
})();


/*--------------------------------------------------
 *   Collision-Shape - ../src/js/collision-shape.js
 */
/**
# CLASS collision-shape
This class defines a collision shape, which defines the 'space' an entity occupies in the collision system. Currently only rectangle shapes can be created (some code exists for right-triangles and circles, but the precise collision checking needed for these is not in place). Collision shapes include an axis-aligned bounding box (AABB) that tightly wraps the shape. The AABB is used for initial collision checks.

## Fields
- **offset** (number []) - An array of length 2 that holds the x and y offset of the collision shape from the owner entity's location.
- **x** (number) - The x position of the shape. The x is always located in the center of the object.
- **y** (number) - The y position of the shape. The y is always located in the center of the object.
- **prevX** (number) - The previous x position of the shape.
- **prevY** (number) - The previous y position of the shape.
- **type** (string) - The type of shape this is. Currently 'rectangle' is the default and only valid type.
- **subType** (string) - **Not Used** Only used for triangles, specifies which corner the right angle is in. Can be: tl, tr, bl, br.
- **points** (number [][]) - Points describing the shape. These points should describe the shape so that the center of the AABB will be at (0,0). For rectangles and circles you only need two points, a top-left and bottom-right. For triangles, you need three. The first should be the right angle, and it should proceed clockwise from there.
- **aABB** (object) - The AABB for this shape.
- **prevAABB** (object) - The previous location of the AABB for this shape.

## Methods
- **constructor** - Creates an object from the collisionShape class.
  > @param ownerLocation (number []) - An array [x,y] of the position.
  > @param type (string) - The type of shape this is. Currently 'rectangle' is the default and only valid type.
  > @param points (number [][]) - Points describing the shape. These points should describe the shape so that the center of the AABB will be at (0,0). For rectangles and circles you only need two points, a top-left and bottom-right. For triangles, you need three. The first should be the right angle, and it should proceed clockwise from there.
  > @param offset (number []) - An array of length 2 that holds the x and y offset of the shape from the owner's location.
- **update** - Updates the location of the shape and AABB. The position you send should be that of the owner, the offset of the shape is added inside the function.
  > @param ownerX (number) - The x position of the owner.
  > @param ownerY (number) - The y position of the owner.
- **reset** - Resets the location of the shape and AABBs so that the current and previous position are the same. The position you send should be that of the owner, the offset of the shape is added inside the function.
  > @param ownerX (number) - The x position of the owner.
  > @param ownerY (number) - The y position of the owner.
- **getXY** - Returns an array containing the position of the shape.
  > @return number [] - An array [x,y] of the position.
- **getX** - Returns the x position of the shape.
  > @return number - The x position.
- **getY** - Return the y position of the shape.
  > @return number - The y position.
- **getPrevXY** - Returns the previous position of the shape.
  > @return number [] - An array [x,y] of the previous position.
- **getPrevX** - Returns the previous x position of the shape.
  > @return number - The previous x position.
- **getPrevY** - Returns the previous y position of the shape.
  > @return number - The previous x position.
- **getAABB** - Returns the AABB of the shape.
  > @return AABB object - The AABB of the shape.
- **getPreviousAABB** - Returns the previous AABB of the shape.
  > @return AABB object - The previous AABB of the shape.
- **getXOffset** - Returns the x offset of the shape.
  > @return number - The x offset.
- **getYOffset** - Returns the y offset of the shape.
  > @return number - The y offset.
- **destroy** - Destroys the shape so that it can be memory collected safely.
*/

platformer.classes.collisionShape = (function(){
	var collisionShape = function(ownerLocation, type, points, offset){
		this.offset = offset || [0,0];
		this.x = ownerLocation[0] + this.offset[0];
		this.y = ownerLocation[1] + this.offset[1];
		this.prevX = this.x;
		this.prevY = this.y;
		this.type = type || 'rectangle';
		this.subType = '';
		this.points = points; //Points should distributed so that the center of the AABB is at (0,0).
		this.aABB = undefined;
		this.prevAABB = undefined;
		
		var width = 0;
		var height = 0; 
		switch (this.type)
		{
		case 'rectangle': //need TL and BR points
		case 'circle': //need TL and BR points
			width = this.points[1][0] - this.points[0][0];
			height = this.points[1][1] - this.points[0][1];
			break;
		case 'triangle': //Need three points, start with the right angle corner and go clockwise.
			if (this.points[0][1] == this.points[1][1] && this.points[0][0] == this.points[2][0])
			{
				if (this.points[0][0] < this.points[1][0])
				{
					//TOP LEFT CORNER IS RIGHT
					this.subType = 'tl';
					width = this.points[1][0] - this.points[0][0];
					height = this.points[2][1] - this.points[0][1];
				} else {
					//BOTTOM RIGHT CORNER IS RIGHT
					this.subType = 'br';
					width = this.points[0][0] - this.points[1][0];
					height = this.points[0][1] - this.points[2][1];
				}
				
			} else if (this.points[0][1] == this.points[2][1] && this.points[0][0] == this.points[1][0]) {
				if (this.points[0][1] < this.points[1][1])
				{
					//TOP RIGHT CORNER IS RIGHT
					this.subType = 'tr';
					width = this.points[0][0] - this.points[2][0];
					height = this.points[1][1] - this.points[0][1];
				} else {
					//BOTTOM LEFT CORNER IS RIGHT
					this.subType = 'bl';
					width = this.points[2][0] - this.points[0][0];
					height = this.points[0][1] - this.points[1][1];
				}
			} 
		}
		
		this.aABB     = new platformer.classes.aABB(this.x, this.y, width, height);
		this.prevAABB = new platformer.classes.aABB(this.x, this.y, width, height);
	};
	var proto = collisionShape.prototype;
	
	proto.update = function(ownerX, ownerY){
		var swap = this.prevAABB; 
		this.prevAABB = this.aABB;
		this.aABB     = swap;
		this.prevX = this.x;
		this.prevY = this.y;
		this.x = ownerX + this.offset[0];
		this.y = ownerY + this.offset[1];
		this.aABB.move(this.x, this.y);
	};
	
	proto.reset = function (ownerX, ownerY) {
		this.prevX = ownerX + this.offset[0];
		this.prevY = ownerY + this.offset[1];
		this.x = ownerX + this.offset[0];
		this.y = ownerY + this.offset[1];
		this.prevAABB.move(this.x, this.y);
		this.aABB.move(this.x, this.y);
	};
	
	proto.getXY = function () {
		return [this.x, this.y];
	};
	
	proto.getX = function () {
		return this.x;
	};
	
	proto.getY = function () {
		return this.y;
	};
	
	proto.getPrevXY = function () {
		return [this.prevX, this.prevY];
	};
	
	proto.getPrevX = function () {
		return this.prevX;
	};
	
	proto.getPrevY = function () {
		return this.prevY;
	};

	proto.getAABB = function(){
		return this.aABB;
	};
	
	proto.getPreviousAABB = function(){
		return this.prevAABB;
	};
	
	proto.getXOffset = function(){
		return this.offset[0];
	};
	
	proto.getYOffset = function(){
		return this.offset[1];
	};
	
	proto.destroy = function(){
		this.aABB = undefined;
		this.points = undefined;
	};
	
	return collisionShape;
})();

/*--------------------------------------------------
 *   AABB - ../src/js/aabb.js
 */
/**
# CLASS aabb
This class defines an axis-aligned bounding box (AABB) which is used during the collision process to determine if two objects are colliding. This is used in a few places including [[Collision-Basic]] and [[Collision-Shape]].

## Fields
- **x** (number) - The x position of the AABB. The x is always located in the center of the object.
- **y** (number) - The y position of the AABB. The y is always located in the center of the object.
- **width** (number) - The width of the AABB.
- **height** (number) - The height of the AABB.
- **halfWidth** (number) - Half the width of the AABB.
- **halfHeight** (number) - Half the height of the AABB.
- **left** (number) - The x-position of the left edge of the AABB.
- **right** (number) - The x-position of the right edge of the AABB.
- **top** (number) - The y-position of the top edge of the AABB.
- **bottom** (number) - The y-position of the bottom edge of the AABB.


## Methods
- **constructor** - Creates an object from the aabb class.
  > @param x (number) - The x position of the AABB. The x is always located in the center of the object.
  > @param y (number) - The y position of the AABB. The y is always located in the center of the object.
  > @param width (number) - The width of the AABB.
  > @param height (number) - The height of the AABB.
  > @return aabb (object) - Returns the new aabb object.
- **setAll** - Sets all of the fields in the AABB.
  > @param x (number) - The x position of the AABB. The x is always located in the center of the object.
  > @param y (number) - The y position of the AABB. The y is always located in the center of the object.
  > @param width (number) - The width of the AABB.
  > @param height (number) - The height of the AABB.
- **reset** - Resets all the values in the AABB so that the AABB can be reused.
- **include** - Changes the size and position of the bounding box so that it contains the current area and the area described in the incoming AABB.
  > @param aabb (object) - The AABB who's area will be included in the area of the current AABB.
- **move** - Moves the AABB to the specified location.
  > @param x (number) - The new x position of the AABB.
  > @param y (number) - The new y position of the AABB.
- **getCopy** - Creates a new AABB with the same fields as this object.
  > @return aabb (object) - Returns the new AABB object.
*/

platformer.classes.aABB = (function(){
	var aABB = function(x, y, width, height){
		this.setAll(x, y, width, height);
	};
	var proto = aABB.prototype;
	
	proto.setAll = function(x, y, width, height){
		this.x = x;
		this.y = y;
		this.width  = width || 0;
		this.height = height || 0;
		this.halfWidth = this.width / 2;
		this.halfHeight = this.height / 2;
		if(typeof x === 'undefined'){
			this.left = undefined;
			this.right = undefined;
		} else {
			this.left = -this.halfWidth + this.x;
			this.right = this.halfWidth + this.x;
		}
		if(typeof y === 'undefined'){
			this.top = undefined;
			this.bottom = undefined;
		} else {
			this.top = -this.halfHeight + this.y;
			this.bottom = this.halfHeight + this.y;
		}
		return this;
	};
	
	proto.reset = function(){
		return this.setAll(undefined, undefined, 0, 0);
	};
	
	proto.include = function(aabb){
		if((this.left > aabb.left)     || (typeof this.left === 'undefined')){
			this.left = aabb.left;
		}
		if((this.right < aabb.right)   || (typeof this.right === 'undefined')){
			this.right = aabb.right;
		}
		if((this.top > aabb.top)       || (typeof this.top === 'undefined')){
			this.top = aabb.top;
		}
		if((this.bottom < aabb.bottom) || (typeof this.bottom === 'undefined')){
			this.bottom = aabb.bottom;
		}
		
		this.width      = this.right  - this.left;
		this.height     = this.bottom - this.top;
		this.halfWidth  = this.width / 2;
		this.halfHeight = this.height / 2;
		this.x          = this.left + this.halfWidth;
		this.y          = this.top  + this.halfHeight;
	};
	
	proto.move = function(x, y){
		this.x = x;
		this.y = y;
		this.left   = -this.halfWidth + this.x;
		this.right  = this.halfWidth + this.x;
		this.top    = -this.halfHeight + this.y;
		this.bottom = this.halfHeight + this.y;
		return this;
	};

	proto.getCopy = function(){
		return new aABB(this.x, this.y, this.width, this.height);
	};
	
	return aABB;
})();
platformer.components = {};

/*--------------------------------------------------
 *   enable-ios-audio - ../src/js/standard-components/enable-ios-audio.js
 */
/**
# COMPONENT **enable-ios-audio**
This component enables JavaScript-triggered audio play-back on iOS devices by overlaying an invisible `div` across the game area that, when touched, causes the audio track to play, giving it necessary permissions for further programmatic play-back. Once touched, it removes itself as a component from the entity as well as removes the layer `div` DOM element.

## Dependencies:
- [createjs.SoundJS] [link1] - This component requires the SoundJS library to be included for audio functionality.
- **rootElement** property (on entity) - This component requires a DOM element which it uses to overlay the touchable audio-instantiation layer `div`.

## JSON Definition:
    {
      "type": "enable-ios-audio",
      
      "audioId": "combined"
      // Required. The SoundJS audio id for the audio clip to be enabled for future play-back.
    }

[link1]: http://www.createjs.com/Docs/SoundJS/module_SoundJS.html
*/
platformer.components['enable-ios-audio'] = (function(){
	var iOSAudioEnabled = false,
	component = function(owner, definition){
		var self = this;
		
		this.owner = owner;
		
		if(!iOSAudioEnabled){
			this.touchOverlay = document.createElement('div');
			this.touchOverlay.style.width    = '100%';
			this.touchOverlay.style.height   = '100%';
			this.touchOverlay.style.position = 'absolute';
			this.touchOverlay.style.zIndex   = '20';
			this.owner.rootElement.appendChild(this.touchOverlay);
			enableIOSAudio(this.touchOverlay, definition.audioId, function(){
				self.removeComponent();
			});
		} else {
			this.removeComponent();
		}
	},
	enableIOSAudio  = function(element, audioId, functionCallback){
		var callback = false,
	    click        = false;
		
		iOSAudioEnabled = true;
		click = function(e){
			var cjsAudio = createjs.SoundJS.play(audioId),
			audio        = cjsAudio.tag,
			forceStop    = function () {
			    audio.removeEventListener('play', forceStop, false);
			    audio.pause();
			},
			progress  = function () {
			    audio.removeEventListener('canplaythrough', progress, false);
			    if (callback) callback();
			};
			
			if(cjsAudio.playState === 'playSucceeded'){
				cjsAudio.stop();
			} else {
				audio.addEventListener('play', forceStop, false);
			    audio.addEventListener('canplaythrough', progress, false);

			    try {
					audio.play();
			    } catch (e) {
			    	callback = function () {
			    		callback = false;
			    		audio.play();
			    	};
			    }
			}
			element.removeEventListener('touchstart', click, false);
			if(functionCallback){
				functionCallback();
			}
		};
		element.addEventListener('touchstart', click, false);
	},
	proto = component.prototype;
	
	proto.removeComponent = function(){
		this.owner.removeComponent(this);
	};
	
	proto.destroy = function(){
		this.owner.rootElement.removeChild(this.touchOverlay);
		this.touchOverlay = undefined;
	};
	
	return component;
})();


/*--------------------------------------------------
 *   handler-controller - ../src/js/standard-components/handler-controller.js
 */
/**
# COMPONENT **handler-controller**
This component handles capturing and relaying input information to the entities that care about it. It takes mouse, keyboard, and custom input messages. State messages are sent immediately to the entities when they are received, the 'handler-controller' message is sent to demarcate ticks.

## Dependencies
- **Needs a 'tick' or 'check-inputs' call** - This component doesn't need a specific component, but it does require a 'tick' or 'check-inputs' call to function. It's usually used as a component of an action-layer.

## Messages

### Listens for:
- **child-entity-added** - Called when a new entity has been added and should be considered for addition to the handler. If the entity has a 'handle-controller' message id it's added to the list of entities. Once an entity is added to the handler-controller 'controller-load' is called on the entity. If an entity has a control map that includes non-keyboard inputs, we add listeners for those and update functions to alert the entity when they happen. 
  > @param entity (Object) - The entity that is being considered for addition to the handler.
- **tick, check-inputs** - Sends a 'handle-controller' message to all the entities the component is handling. If an entity does not handle the message, it's removed it from the entity list.
  > @param resp (object) - An object containing deltaT which is the time passed since the last tick. 
- **keydown** - Sends a message to the handled entities 'key:' + the key id + ":down". 
  > @param event (DOM event) - The DOM event that triggered the keydown event. 
 - **keyup** - Sends a message to the handled entities 'key:' + the key id + ":up".
  > @param event (DOM event) - The DOM event that triggered the keyup event. 

### Peer Broadcasts:
- **handle-controller** - Sent to entities on each tick to handle whatever they need to regarding controls..
  > @param resp (object) - An object containing a deltaT variable that is the time that's passed since the last tick.
- **controller-load** - Sent to entities when they are added to the handler-controller.
- **key:keyid:up** - Message sent to an entity when a key goes from down to up.
  > @param event (DOM event) - The DOM event that triggered the keyup event. 
- **key:keyid:down** - Message sent to an entity when a key goes from up to down.
  > @param event (DOM event) - The DOM event that triggered the keydown event. 
- **custom:up and custom:down messages** - Messages created when an entity has a control map with non-keyboard input. The handler creates these message when it adds the entity and then fires them on the entity when the input is received.
  > @param value (object) - A message object sent by the custom message.

## JSON Definition
    {
      "type": "handler-controller",
    }
*/

platformer.components['handler-controller'] = (function(){
	var relayUpDown = function(event, self){
		return function(value){
			if (value.released){
				event += ':up';
			} else if (value.pressed){
				event += ':down';
			}
			for (var x = 0; x < self.entities.length; x++) {
				self.entities[x].trigger(event, value);
			}
		}; 
	};
	var relay = function(event, self){
		return function(value){
			for (var x = 0; x < self.entities.length; x++) {
				self.entities[x].trigger(event, value);
			}
		}; 
	};
	
	var keyMap = {
		kc0:   'unknown',         
		kc8:   'backspace',
		kc9:   'tab',
		kc12:  'numpad-5-shift',
		kc13:  'enter',
		kc16:  'shift',
		kc17:  'ctrl',
		kc18:  'alt',
		kc19:  'pause',
		kc20:  'caps-lock',
		kc27:  'esc',
		kc32:  'space',
		kc33:  'page-up',
		kc34:  'page-down',
		kc35:  'end',
		kc36:  'home',
		kc37:  'left-arrow',
		kc38:  'up-arrow',
		kc39:  'right-arrow',
		kc40:  'down-arrow',
		kc42:  'numpad-multiply',
		kc43:  'numpad-add',
		kc44:  'print-screen',
		kc45:  'insert',
		kc46:  'delete',
		kc47:  'numpad-division',
		kc48:  '0',
		kc49:  '1',
		kc50:  '2',
		kc51:  '3',
		kc52:  '4',
		kc53:  '5',
		kc54:  '6',
		kc55:  '7',
		kc56:  '8',
		kc57:  '9',
		kc59:  'semicolon',
		kc61:  'equals',
		kc65:  'a',
		kc66:  'b',
		kc67:  'c',
		kc68:  'd',
		kc69:  'e',
		kc70:  'f',
		kc71:  'g',
		kc72:  'h',
		kc73:  'i',
		kc74:  'j',
		kc75:  'k',
		kc76:  'l',
		kc77:  'm',
		kc78:  'n',
		kc79:  'o',
		kc80:  'p',
		kc81:  'q',
		kc82:  'r',
		kc83:  's',
		kc84:  't',
		kc85:  'u',
		kc86:  'v',
		kc87:  'w',
		kc88:  'x',
		kc89:  'y',
		kc90:  'z',
		kc91:  'left-windows-start',
		kc92:  'right-windows-start',
		kc93:  'windows-menu',
		kc96:  'back-quote',
		kc106: 'numpad-multiply',
		kc107: 'numpad-add',
		kc109: 'numpad-minus',
		kc110: 'numpad-period',
		kc111: 'numpad-division',
		kc112: 'f1',
		kc113: 'f2',
		kc114: 'f3',
		kc115: 'f4',
		kc116: 'f5',
		kc117: 'f6',
		kc118: 'f7',
		kc119: 'f8',
		kc120: 'f9',
		kc121: 'f10',
		kc122: 'f11',
		kc123: 'f12',
		kc144: 'num-lock',
		kc145: 'scroll-lock',
		kc186: 'semicolon',
		kc187: 'equals',
		kc188: 'comma',
		kc189: 'hyphen',
		kc190: 'period',
		kc191: 'forward-slash',
		kc192: 'back-quote',
		kc219: 'open-bracket',
		kc220: 'back-slash',
		kc221: 'close-bracket',
		kc222: 'quote'
	};
	var component = function(owner, definition){
		this.owner = owner;
		this.entities = [];
		
		// Messages that this component listens for
		this.listeners = [];
		
		this.addListeners(['tick', 'child-entity-added', 'check-inputs', 'keydown', 'keyup']);
		
		this.timeElapsed = {
				name: 'Controller',
				time: 0
			};
	};
	var proto = component.prototype; 

	proto['keydown'] = function(event){
		for (var x = 0; x < this.entities.length; x++)
		{
			this.entities[x].trigger('key:' + (keyMap['kc' + event.keyCode] || ('key-code-' + event.keyCode)) + ':down', event);
		}
	}; 
	
	proto['keyup'] = function(event){
		for (var x = 0; x < this.entities.length; x++)
		{
			this.entities[x].trigger('key:' + (keyMap['kc' + event.keyCode] || ('key-code-' + event.keyCode)) + ':up', event);
		}
	};
	
	proto['tick'] = proto['check-inputs'] = function(resp){
		var time    = new Date().getTime();

		for (var x = this.entities.length - 1; x > -1; x--)
		{
			if(!this.entities[x].trigger('handle-controller', resp))	
			{
				this.entities.splice(x, 1);
			}
		}
		
		this.timeElapsed.time = new Date().getTime() - time;
		platformer.game.currentScene.trigger('time-elapsed', this.timeElapsed);
	};

	proto['child-entity-added'] = function(entity){
		var messageIds = entity.getMessageIds(); 
		
		for (var x = 0; x < messageIds.length; x++)
		{
			if (messageIds[x] == 'handle-controller')
			{
				// Check for custom input messages that should be relayed from scene.
				if(entity.controlMap){
					for(var y in entity.controlMap){
						if((y.indexOf('key:') < 0) && (y.indexOf('mouse:') < 0)){
							if(!this[y]){
								this.addListeners([y, y + ':up', y + ':down']);
								this[y]           = relayUpDown(y,     this);
								this[y + ':up']   = relay(y + ':up',   this);
								this[y + ':down'] = relay(y + ':down', this);
							}
						}
					}
				}
				
				this.entities.push(entity);
				entity.trigger('controller-load');
				break;
			}
		}
	};

	// This function should never be called by the component itself. Call this.owner.removeComponent(this) instead.
	proto.destroy = function(){
		this.removeListeners(this.listeners);
		this.entities.length = 0;
		this.owner = undefined;
	};
	
	/*********************************************************************************************************
	 * The stuff below here will stay the same for all components. It's BORING!
	 *********************************************************************************************************/
	
	proto.addListeners = function(messageIds){
		for(var message in messageIds) this.addListener(messageIds[message]);
	};

	proto.removeListeners = function(listeners){
		for(var messageId in listeners) this.removeListener(messageId, listeners[messageId]);
	};
	
	proto.addListener = function(messageId, callback){
		var self = this,
		func = callback || function(value, debug){
			self[messageId](value, debug);
		};
		this.owner.bind(messageId, func);
		this.listeners[messageId] = func;
	};

	proto.removeListener = function(boundMessageId, callback){
		this.owner.unbind(boundMessageId, callback);
	};
	
	return component;
})();


/*--------------------------------------------------
 *   tiled-loader - ../src/js/standard-components/tiled-loader.js
 */
/**
# COMPONENT **tiled-loader**
This component is attached to a top-level entity (loaded by the [[Scene]]) and, once its peer components are loaded, ingests a JSON file exported from the [Tiled map editor] [link1] and creates the tile maps and entities. Once it has finished loading the map, it removes itself from the list of components on the entity.

## Dependencies:
- Component [[Entity-Container]] (on entity's parent) - This component uses `entity.addEntity()` on the entity, provided by `entity-container`.
- Entity **collision-layer** - Used to create map entities corresponding with Tiled collision layers.
- Entity **render-layer** - Used to create map entities corresponding with Tiled render layers.
- Entity **tile-layer** - Used to create map entities corresponding with Tiled collision and render layers.

## Messages

### Listens for:
- **load** - On receiving this message, the component commences loading the Tiled map JSON definition. Once finished, it removes itself from the entity's list of components.

### Local Broadcasts:
- **world-loaded** - Once finished loading the map, this message is triggered on the entity to notify other components of completion.
  > @param message.width (number) - The width of the world in world units.
  > @param message.height (number) - The height of the world in world units.
  > @param message.camera ([[Entity]]) - If a camera property is found on one of the loaded entities, this property will point to the entity on load that a world camera should focus on.

## JSON Definition:
    {
      "type": "tiled-loader",
      
      "level": "level-4",
      // Required. Specifies the JSON level to load.
      
      "unitsPerPixel": 10,
      // Optional. Sets how many world units in width and height correspond to a single pixel in the Tiled map. Default is 1: One pixel is one world unit.
      
      "images": ["spritesheet-1", "spritesheet-2"],
      // Optional. If specified, the referenced images are used as the game spritesheets instead of the images referenced in the Tiled map. This is useful for using different or better quality art from the art used in creating the Tiled map.
      
      "imagesScale": 5,
      // Optional. If images are set above, this property sets the scale of the art relative to world coordinates. Defaults to the value set in "unitsPerPixel".
      
      "zStep": 500,
      // Optional. Adds step number to each additional Tiled layer to maintain z-order. Defaults to 1000.
      
      "separateTiles": true,
      // Optional. Keeps the tile maps in separate render layers. Default is 'false' to for better optimization.
      
      "entityPositionX": "center",
      // Optional. Can be "left", "right", or "center". Defines where entities registered X position should be when spawned. Default is "center".

      "entityPositionY": "center"
      // Optional. Can be "top", "bottom", or "center". Defines where entities registered Y position should be when spawned. Default is "bottom".
    }

[link1]: http://www.mapeditor.org/
*/
platformer.components['tiled-loader'] = (function(){
	var component = function(owner, definition){
		this.owner        = owner;
		this.entities     = [];
		this.layerZ       = 0;
		this.followEntity = false;
		this.listeners    = [];

		this.level = platformer.settings.levels[this.owner.level || definition.level];

		this.unitsPerPixel = this.owner.unitsPerPixel || definition.unitsPerPixel || 1;
		this.images        = this.owner.images        || definition.images        || false;
		this.imagesScale   = this.owner.imagesScale   || definition.imagesScale   || this.unitsPerPixel;
		this.layerZStep    = this.owner.zStep         || definition.zStep         || 1000;
		this.separateTiles = this.owner.separateTiles || definition.separateTiles || false;
		this.entityPositionX = this.owner.entityPositionX || definition.entityPositionX || 'center';
		this.entityPositionY = this.owner.entityPositionY || definition.entityPositionY || 'bottom';

		// Messages that this component listens for
		this.addListeners(['load']);
	},
	proto = component.prototype; 

	proto['load'] = function(){
		var actionLayer = 0,
		layer = false;
		
		for(; actionLayer < this.level.layers.length; actionLayer++){
			layer = this.setupLayer(this.level.layers[actionLayer], this.level, layer);
			if (this.separateTiles){
				layer = false;
			}
		}
		this.owner.trigger('world-loaded', {
			width:  this.level.width  * this.level.tilewidth  * this.unitsPerPixel,
			height: this.level.height * this.level.tileheight * this.unitsPerPixel,
			camera: this.followEntity
		});
		this.owner.removeComponent(this);
	};
	
	proto.setupLayer = function(layer, level, combineRenderLayer){
		var self       = this,
		images         = self.images || [],
		tilesets       = level.tilesets,
		tileWidth      = level.tilewidth,
		tileHeight     = level.tileheight,
		widthOffset    = 0,
		heightOffset   = 0,
		tileTypes      = (tilesets[tilesets.length - 1].imagewidth / tileWidth) * (tilesets[tilesets.length - 1].imageheight / tileHeight) + tilesets[tilesets.length - 1].firstgid,
		x              = 0,
		y              = 0,
		obj            = 0,
		entity         = undefined,
		entityType     = '',
		tileset        = undefined,
		properties     = undefined,
		layerCollides  = true,
		numberProperty = false,
		createLayer = function(entityKind){
			var width      = layer.width,
			height         = layer.height,
			tileDefinition = undefined,
			importAnimation= undefined,
			importCollision= undefined,
			importRender   = undefined,
			renderTiles    = false;
			
			//TODO: a bit of a hack to copy an object instead of overwrite values
			tileDefinition  = JSON.parse(JSON.stringify(platformer.settings.entities[entityKind]));

			importAnimation = {};
			importCollision = [];
			importRender    = [];

			tileDefinition.properties            = tileDefinition.properties || {};
			tileDefinition.properties.width      = tileWidth  * width  * self.unitsPerPixel;
			tileDefinition.properties.height     = tileHeight * height * self.unitsPerPixel;
			tileDefinition.properties.columns    = width;
			tileDefinition.properties.rows       = height;
			tileDefinition.properties.tileWidth  = tileWidth  * self.unitsPerPixel;
			tileDefinition.properties.tileHeight = tileHeight * self.unitsPerPixel;
			tileDefinition.properties.scaleX     = self.imagesScale;
			tileDefinition.properties.scaleY     = self.imagesScale;
			tileDefinition.properties.layerZ     = self.layerZ;
			tileDefinition.properties.z    		 = self.layerZ;
			
			
			for (x = 0; x < tileTypes; x++){
				importAnimation['tile' + x] = x;
			}
			for (x = 0; x < width; x++){
				importCollision[x] = [];
				importRender[x]    = [];
				for (y = 0; y < height; y++){
					importCollision[x][y] = +layer.data[x + y * width] - 1;
					importRender[x][y] = 'tile' + (+layer.data[x + y * width] - 1);
				}
			}
			for (x = 0; x < tileDefinition.components.length; x++){
				if(tileDefinition.components[x].type === 'render-tiles'){
					renderTiles = tileDefinition.components[x]; 
				}
				if(tileDefinition.components[x].spriteSheet == 'import'){
					tileDefinition.components[x].spriteSheet = {
						images: images,
						frames: {
							width:  tileWidth * self.unitsPerPixel / self.imagesScale,
							height: tileHeight * self.unitsPerPixel / self.imagesScale
						},
						animations: importAnimation
					};
				}
				if(tileDefinition.components[x].collisionMap == 'import'){
					tileDefinition.components[x].collisionMap = importCollision;
				}
				if(tileDefinition.components[x].imageMap == 'import'){
					tileDefinition.components[x].imageMap = importRender;
				}
			}
			self.layerZ += self.layerZStep;
			
			if((entityKind === 'render-layer') && combineRenderLayer){
				combineRenderLayer.trigger('add-tiles', renderTiles);
				return combineRenderLayer; 
			} else {
				return self.owner.addEntity(new platformer.classes.entity(tileDefinition, {properties:{}})); 
			}
		};

		if(images.length == 0){
			for (x = 0; x < tilesets.length; x++){
				if(platformer.assets[tilesets[x].name]){ // Prefer to have name in tiled match image id in game
					images.push(platformer.assets[tilesets[x].name]);
				} else {
					images.push(tilesets[x].image);
				}
			}
		} else {
			images = images.slice(); //so we do not overwrite settings array
			for (x = 0; x < images.length; x++){
				if(platformer.assets[images[x]]){
					images[x] = platformer.assets[images[x]];
				}
			}
		}
		
		if(layer.type == 'tilelayer'){
			// First determine which type of entity this layer should behave as:
			entity = 'render-layer'; // default
			if(layer.properties && layer.properties.entity){
				entity = layer.properties.entity;
			} else { // If not explicitly defined, try using the name of the layer
				switch(layer.name){
				case "collision":
					entity = 'collision-layer';
					break;
				case "action":
					entity = 'tile-layer';
					for (x = 0; x < level.layers.length; x++){
						if(level.layers[x].name === 'collision' || (level.layers[x].properties && level.layers[x].properties.entity === 'collision-layer')){
							layerCollides = false;
						}
					}
					if(!layerCollides){
						entity = 'render-layer';
					}
					break;
				}
			}
			
			if(entity === 'tile-layer'){
				createLayer('collision-layer');
				return createLayer('render-layer', combineRenderLayer);
			} else {
				return createLayer(entity, combineRenderLayer);
			}
		} else if(layer.type == 'objectgroup'){
			for (obj = 0; obj < layer.objects.length; obj++){
				entity = layer.objects[obj];
				for (x = 0; x < tilesets.length; x++){
					if(tilesets[x].firstgid > entity.gid){
						break;
					} else {
						tileset = tilesets[x];
					}
				}
				
				// Check Tiled data to find this object's type
				entityType = '';
				if(entity.type !== ''){
					entityType = entity.type;
				} else if(tileset.tileproperties[entity.gid - tileset.firstgid]){
					if(tileset.tileproperties[entity.gid - tileset.firstgid].entity){
						entityType = tileset.tileproperties[entity.gid - tileset.firstgid].entity;
					} else if (tileset.tileproperties[entity.gid - tileset.firstgid].type){
						entityType = tileset.tileproperties[entity.gid - tileset.firstgid].type;
					}
				}
				
				if(entityType !== ''){
					properties = {};
					//Copy properties from Tiled

					if(tileset.tileproperties[entity.gid - tileset.firstgid]){
						for (x in tileset.tileproperties[entity.gid - tileset.firstgid]){
							//This is going to assume that if you pass in something that starts with a number, it is a number and converts it to one.
							numberProperty = parseFloat(tileset.tileproperties[entity.gid - tileset.firstgid][x]);
							if (numberProperty == 0 || (!!numberProperty))
							{
								properties[x] = numberProperty;
							} else if(tileset.tileproperties[entity.gid - tileset.firstgid][x] == 'true') {
								properties[x] = true;
							} else if(tileset.tileproperties[entity.gid - tileset.firstgid][x] == 'false') {
								properties[x] = false;
							} else {
								properties[x] = tileset.tileproperties[entity.gid - tileset.firstgid][x];
							}
						}
					}
					
					for (x in entity.properties){
						//This is going to assume that if you pass in something that starts with a number, it is a number and converts it to one.
					    numberProperty = parseFloat(entity.properties[x]);
						if (numberProperty == 0 || (!!numberProperty))
						{
							properties[x] = numberProperty;
						} else if(entity.properties[x] == 'true') {
							properties[x] = true;
						} else if(entity.properties[x] == 'false') {
							properties[x] = false;
						} else {
							properties[x] = entity.properties[x];
						}
					}
					widthOffset  = properties.width  = (entity.width  || tileWidth)  * this.unitsPerPixel;
					heightOffset = properties.height = (entity.height || tileHeight) * this.unitsPerPixel;
					if (entityType && platformer.settings.entities[entityType] && platformer.settings.entities[entityType].properties) {
						properties.width  = platformer.settings.entities[entityType].properties.width  || properties.width;
						properties.height = platformer.settings.entities[entityType].properties.height || properties.height;
					}

					properties.x = entity.x * this.unitsPerPixel;
					if(this.entityPositionX === 'left'){
						properties.regX = 0;
					} else if(this.entityPositionX === 'center'){
						properties.regX = properties.width / 2;
						properties.x += widthOffset / 2;
					} else if(this.entityPositionX === 'right'){
						properties.regX = properties.width;
						properties.x += widthOffset;
					}

					properties.y = entity.y * this.unitsPerPixel;
					if(typeof entity.gid === 'undefined'){
						properties.y += properties.height;
					}
					if(this.entityPositionY === 'bottom'){
						properties.regY = properties.height;
					} else if(this.entityPositionY === 'center'){
						properties.regY = properties.height / 2;
						properties.y -= heightOffset / 2;
					} else if(this.entityPositionY === 'top'){
						properties.regY = 0;
						properties.y -= heightOffset;
					}

					properties.scaleX = this.imagesScale;//this.unitsPerPixel;
					properties.scaleY = this.imagesScale;//this.unitsPerPixel;
					properties.layerZ = this.layerZ;
					
					//Setting the z value. All values are getting added to the layerZ value.
					if (properties.z) {
						properties.z += this.layerZ;
					} else if (entityType && platformer.settings.entities[entityType] && platformer.settings.entities[entityType].properties && platformer.settings.entities[entityType].properties.z) {
						properties.z = this.layerZ + platformer.settings.entities[entityType].properties.z;
					} else {
						properties.z = this.layerZ;
					}
					
					entity = this.owner.addEntity(new platformer.classes.entity(platformer.settings.entities[entityType], {properties:properties}));
					if(entity){
						if(entity.camera){
							this.followEntity = {entity: entity, mode: entity.camera}; //used by camera
						}
					}
				}
			}
			this.layerZ += this.layerZStep;
			return false;
		}
	};

	// This function should never be called by the component itself. Call this.owner.removeComponent(this) instead.
	proto.destroy = function(){
		this.removeListeners(this.listeners);
		this.entities.length = 0;
	};
	
	/*********************************************************************************************************
	 * The stuff below here can be left alone. 
	 *********************************************************************************************************/
	
	proto.addListeners = function(messageIds){
		for(var message in messageIds) this.addListener(messageIds[message]);
	};

	proto.removeListeners = function(listeners){
		for(var messageId in listeners) this.removeListener(messageId, listeners[messageId]);
	};
	
	proto.addListener = function(messageId, callback){
		var self = this,
		func = callback || function(value, debug){
			self[messageId](value, debug);
		};
		this.owner.bind(messageId, func);
		this.listeners[messageId] = func;
	};

	proto.removeListener = function(boundMessageId, callback){
		this.owner.unbind(boundMessageId, callback);
	};
	
	return component;
})();


/*--------------------------------------------------
 *   handler-render-createjs - ../src/js/standard-components/handler-render-createjs.js
 */
/**
# COMPONENT **handler-render-createjs**
A component that handles updating rendering for components that are rendering via createjs. Each tick it calls all the entities that accept 'handle-render' messages.

## Dependencies
- **Needs a 'tick' or 'render' call** - This component doesn't need a specific component, but it does require a 'tick' or 'render' call to function. It's usually used as a component of an action-layer.
- [createjs.EaselJS][link1] - This component requires the EaselJS library to be included for canvas functionality.

## Messages

### Listens for:
- **child-entity-added** - Called when a new entity has been added to the parent and should be considered for addition to the handler. If the entity has a 'handle-render' or 'handle-render-load' message id it's added to the list of entities. Entities are sent a reference to the stage that we're rendering to, so they can add their display objects to it. 
  > @param entity (Object) - The entity that is being considered for addition to the handler.
- **tick, render** - Sends a 'handle-render' message to all the entities the component is handling. If an entity does not handle the message, it's removed it from the entity list. This function also sorts the display objects in the stage according to their z value. We detect when new objects are added by keeping track of the front element. If it changes the list gets resorted. Finally the whole stage is updated by CreateJS.
  > @param resp (object) - An object containing deltaT which is the time passed since the last tick. 
- **camera-update** - Called when the camera moves in the world, or if the window is resized. This function sets the canvas size and the stage transform.
  > @param cameraInfo (object) - An object containing the camera information. 


### Peer Broadcasts:
- **handle-render** - Sent to entities to run their render for the tick.
  > @param object (object) - An object containing a deltaT variable that is the time that's passed since the last tick.
- **handle-render-load** - Sent to entities to prepare for rendering. Sends along the stage object so the entity can add its display objects. It also sends the parent DOM element of the canvas.
  > @param object.stage ([createjs.Stage][link2]) - The createjs stage object.
  > @param object.parentElement (object) - The DOM parent element of the canvas. 

## JSON Definition
    {
      "type": "handler-render-createjs"
    }
    
[link1]: http://www.createjs.com/Docs/EaselJS/module_EaselJS.html
[link2]: http://createjs.com/Docs/EaselJS/Stage.html
*/

platformer.components['handler-render-createjs'] = (function(){
	var component = function(owner, definition){
		this.owner = owner;
		this.entities = [];
		
		// Messages that this component listens for
		this.listeners = [];
		this.addListeners(['tick', 'child-entity-added', 'render', 'camera-update']);
		
		this.canvas = this.owner.canvas = document.createElement('canvas');
		this.owner.rootElement.appendChild(this.canvas);
		this.canvas.style.width = '100%';
		this.canvas.style.height = '100%';
		this.canvas.width  = 320;
		this.canvas.height = 240;
//		this.canvas.style.webkitTransform = 'translate3d(0,0,0)';
//		this.canvas.style.transform = 'translate3d(0,0,0)';
		
		this.stage = new createjs.Stage(this.canvas);
		this.stage.snapToPixelEnabled = true;
		
		this.camera = {
			left: 0,
			top: 0,
			width: 0,
			height: 0,
			buffer: definition.buffer || 0
		};
		this.firstChild = undefined;
		this.timeElapsed = {
			name: 'Render',
			time: 0
		};
	},
	proto = component.prototype; 

	proto['child-entity-added'] = function(entity){
		var self = this,
		messageIds = entity.getMessageIds(); 
		
		for (var x = 0; x < messageIds.length; x++)
		{
			if ((messageIds[x] == 'handle-render') || (messageIds[x] == 'handle-render-load')){
				this.entities.push(entity);
				entity.trigger('handle-render-load', {
					stage: self.stage,
					parentElement: self.owner.rootElement
				});
				break;
			}
		}
	};
	
	proto['tick'] = proto['render'] = function(resp){
		var child = undefined,
		time    = new Date().getTime();
		
		for (var x = this.entities.length - 1; x > -1; x--){
			if(!this.entities[x].trigger('handle-render', resp))
			{
				this.entities.splice(x, 1);
			}
		}
		for (var x = this.stage.children.length - 1; x > -1; x--){
			child = this.stage.children[x];
			if(child.name !== 'entity-managed'){
				if((child.x >= this.camera.x - this.camera.buffer) && (child.x <= this.camera.x + this.camera.width + this.camera.buffer) && (child.y >= this.camera.y - this.camera.buffer) && (child.y <= this.camera.y + this.camera.height + this.camera.buffer)){
					if(!child.visible) child.visible = true;
				} else {
					if(child.visible) child.visible = false;
				}
			}
		}
		
		if (this.stage.getChildAt(0) !== this.firstChild)
		{
			this.stage.sortChildren(function(a, b) {
				return a.z - b.z;
			});
			this.firstChild = this.stage.getChildAt(0);
		}

		this.timeElapsed.name = 'Render-Prep';
		this.timeElapsed.time = new Date().getTime() - time;
		platformer.game.currentScene.trigger('time-elapsed', this.timeElapsed);
		time += this.timeElapsed.time;

		this.stage.update();
		this.timeElapsed.name = 'Render';
		this.timeElapsed.time = new Date().getTime() - time;
		platformer.game.currentScene.trigger('time-elapsed', this.timeElapsed);
	};
	
	proto['camera-update'] = function(cameraInfo){
		this.camera.x = cameraInfo.viewportLeft;
		this.camera.y = cameraInfo.viewportTop;
		this.camera.width = cameraInfo.viewportWidth;
		this.camera.height = cameraInfo.viewportHeight;
		if(!this.camera.buffer){
			this.camera.buffer = this.camera.width / 12; // sets a default buffer based on the size of the world units if the buffer was not explicitly set.
		}
		
		this.canvas.width  = this.canvas.offsetWidth;
		this.canvas.height = this.canvas.offsetHeight;
		this.stage.setTransform(-cameraInfo.viewportLeft * cameraInfo.scaleX, -cameraInfo.viewportTop * cameraInfo.scaleY, cameraInfo.scaleX, cameraInfo.scaleY);
	};
	
	// This function should never be called by the component itself. Call this.owner.removeComponent(this) instead.
	proto.destroy = function(){
		this.removeListeners(this.listeners);
		this.stage = undefined;
		this.owner.rootElement.removeChild(this.canvas);
		this.canvas = undefined;
		this.entities.length = 0;
		this.owner = undefined;
	};
	
	/*********************************************************************************************************
	 * The stuff below here can be left alone. 
	 *********************************************************************************************************/
	
	proto.addListeners = function(messageIds){
		for(var message in messageIds) this.addListener(messageIds[message]);
	};

	proto.removeListeners = function(listeners){
		for(var messageId in listeners) this.removeListener(messageId, listeners[messageId]);
	};
	
	proto.addListener = function(messageId, callback){
		var self = this,
		func = callback || function(value, debug){
			self[messageId](value, debug);
		};
		this.owner.bind(messageId, func);
		this.listeners[messageId] = func;
	};

	proto.removeListener = function(boundMessageId, callback){
		this.owner.unbind(boundMessageId, callback);
	};
	
	return component;
})();


/*--------------------------------------------------
 *   handler-render-dom - ../src/js/standard-components/handler-render-dom.js
 */
/**
# COMPONENT **handler-render-dom**
A component that handles the rendering of DOM elements. It creates a div element that it then shares with entities to add themselves too. It then alerts these entities when they should load and update their rendering.

## Dependencies
- **Needs a 'tick' or 'render' call** - This component doesn't need a specific component, but it does require a 'tick' or 'render' call to function. It's usually used as a component of an action-layer.

## Messages

### Listens for:
- **child-entity-added** - Called when a new entity has been added and should be considered for addition to the handler. If the entity has a 'handle-render' or 'handle-render-load' message id it's added to the list of entities. Also the 'handle-render-load' message is called immediately.
  > @param entity (Object) - The entity that is being considered for addition to the handler.
- **tick, render** - Sends a 'handle-render' message to all the entities the component is handling. If an entity does not handle the message, it's removed it from the entity list.
  > @param resp (object) - An object containing deltaT which is the time passed since the last tick. 

### Peer Broadcasts:
- **handle-render-load** - Sent to an entity that has finished loading to prepare itself before the first render cycle. Passes the entity a div element that it can add itself to.
  > @param obj.element (Object) - An object containing a DOM element that the entity should add child elements to.
- **handle-render** - Sent to entities to have them prepare to be rendered.
  > @param object - An object containing a deltaT variable that is the time that's passed since the last tick.

## JSON Definition
    {
      "type": "handler-render-dom",
    }
*/

platformer.components['handler-render-dom'] = (function(){
	var component = function(owner, definition){
		this.owner = owner;
		this.entities = [];
		
		// Messages that this component listens for
		this.listeners = [];
		this.addListeners(['tick', 'child-entity-added', 'render']);
		
		this.element = this.owner.element = document.createElement('div');
		this.owner.rootElement.appendChild(this.element);
//		this.element.style.position = 'absolute';
//		this.element.style.width = '100%';
//		this.element.style.height = '100%';
	},
	proto = component.prototype; 

	proto['child-entity-added'] = function(entity){
		var self = this,
		messageIds = entity.getMessageIds(); 
		
		for (var x = 0; x < messageIds.length; x++)
		{
			if ((messageIds[x] == 'handle-render') || (messageIds[x] == 'handle-render-load')){
				this.entities.push(entity);
				entity.trigger('handle-render-load', {
					element: self.element
				});
				break;
			}
		}
	};
	
	proto['tick'] = proto['render'] = function(resp){
		for (var x = this.entities.length - 1; x > -1; x--)
		{
			if(!this.entities[x].trigger('handle-render', resp))
			{
				this.entities.splice(x, 1);
			}
			
		}
	};
	
	// This function should never be called by the component itself. Call this.owner.removeComponent(this) instead.
	proto.destroy = function(){
		this.removeListeners(this.listeners);
		this.owner.rootElement.removeChild(this.element);
		this.element = undefined;
		this.entities.length = 0;
		this.owner = undefined;
	};
	
	/*********************************************************************************************************
	 * The stuff below here can be left alone. 
	 *********************************************************************************************************/
	
	proto.addListeners = function(messageIds){
		for(var message in messageIds) this.addListener(messageIds[message]);
	};

	proto.removeListeners = function(listeners){
		for(var messageId in listeners) this.removeListener(messageId, listeners[messageId]);
	};
	
	proto.addListener = function(messageId, callback){
		var self = this,
		func = callback || function(value, debug){
			self[messageId](value, debug);
		};
		this.owner.bind(messageId, func);
		this.listeners[messageId] = func;
	};

	proto.removeListener = function(boundMessageId, callback){
		this.owner.unbind(boundMessageId, callback);
	};
	
	return component;
})();


/*--------------------------------------------------
 *   handler-ai - ../src/js/standard-components/handler-ai.js
 */
/**
# COMPONENT **handler-ai**
A component that handles updating ai components. Each tick it calls all the entities that accept 'handle-ai' messages.

## Dependencies
- **Needs a 'tick' call** - This component doesn't need a specific component, but it does require a 'tick' call to function. It's usually used as a component of an action-layer.

## Messages

### Listens for:
- **child-entity-added** - Called when a new entity has been added and should be considered for addition to the handler. If the entity has a 'handle-ai' message id it's added to the list of entities. 
  > @param entity (Object) - The entity that is being considered for addition to the handler.
- **tick** - Sends a 'handle-ai' message to all the entities the component is handling. If an entity does not handle the message, it's removed it from the entity list.
  > @param obj (object) - An object containing deltaT which is the time passed since the last tick. 

### Peer Broadcasts:
- **handle-ai** - Sent to entities to run their ai for the tick.
  > @param object - An object containing a deltaT variable that is the time that's passed since the last tick.

## JSON Definition
    {
      "type": "handler-ai"
    }
*/

platformer.components['handler-ai'] = (function(){
	var component = function(owner, definition){
		this.owner = owner;
		this.entities = [];
		
		// Messages that this component listens for
		this.listeners = [];
		this.addListeners(['child-entity-added', 'tick']);  
		
	};
	var proto = component.prototype; 

	proto['child-entity-added'] = function(entity){
		var self = this,
		messageIds = entity.getMessageIds(); 
		
		for (var x = 0; x < messageIds.length; x++)
		{
			if (messageIds[x] == 'handle-ai')
			{
				this.entities.push(entity);
				break;
			}
		}
	};

	proto['tick'] = function(obj){
		for (var x = this.entities.length - 1; x > -1; x--)
		{
			if(!this.entities[x].trigger('handle-ai', obj))
			{
				this.entities.splice(x, 1);
			}
		}
	};
	
	// This function should never be called by the component itself. Call this.owner.removeComponent(this) instead.
	proto.destroy = function(){
		this.removeListeners(this.listeners);
	};
	
	/*********************************************************************************************************
	 * The stuff below here will stay the same for all components. It's BORING!
	 *********************************************************************************************************/
	
	proto.addListeners = function(messageIds){
		for(var message in messageIds) this.addListener(messageIds[message]);
	};

	proto.removeListeners = function(listeners){
		for(var messageId in listeners) this.removeListener(messageId, listeners[messageId]);
	};
	
	proto.addListener = function(messageId, callback){
		var self = this,
		func = callback || function(value, debug){
			self[messageId](value, debug);
		};
		this.owner.bind(messageId, func);
		this.listeners[messageId] = func;
	};

	proto.removeListener = function(boundMessageId, callback){
		this.owner.unbind(boundMessageId, callback);
	};
	
	return component;
})();


/*--------------------------------------------------
 *   handler-logic - ../src/js/standard-components/handler-logic.js
 */
/**
# COMPONENT **handler-logic**
A component that handles updating logic components. Each tick it calls all the entities that accept 'handle-logic' messages.

## Dependencies
- **Needs a 'tick' or 'logic' call** - This component doesn't need a specific component, but it does require a 'tick' or 'logic' call to function. It's usually used as a component of an action-layer.

## Messages

### Listens for:
- **child-entity-added** - Called when a new entity has been added and should be considered for addition to the handler. If the entity has a 'handle-logic' message id it's added to the list of entities. 
  > @param entity (Object) - The entity that is being considered for addition to the handler.
- **tick, logic** - Sends a 'handle-logic' message to all the entities the component is handling. If an entity does not handle the message, it's removed it from the entity list.
  > @param resp (object) - An object containing deltaT which is the time passed since the last tick. 

### Peer Broadcasts:
- **handle-logic** - Sent to entities to run their logic.
  > @param object - An object containing a deltaT variable that is the time that's passed since the last tick.

## JSON Definition
    {
      "type": "handler-logic",
    }
*/

platformer.components['handler-logic'] = (function(){
	var component = function(owner, definition){
		this.owner = owner;
		this.entities = [];
		
		// Messages that this component listens for
		this.listeners = [];
		
		this.addListeners(['tick', 'camera-update', 'child-entity-added', 'logic']);  
		
		this.stepLength    = definition.stepLength || 30;//15;
		this.leftoverTime = 0;
		this.maximumStepsPerTick = 10; //Math.ceil(500 / this.stepLength);
		this.camera = {
			left: 0,
			top: 0,
			width: 0,
			height: 0,
			buffer: definition.buffer || 0
		};
		this.message = {
			deltaT: this.stepLength,
			tick: null,
			camera: this.camera
		};
		this.timeElapsed = {
			name: 'Logic',
			time: 0
		};
	};
	var proto = component.prototype; 

	proto['child-entity-added'] = function(entity){
		var messageIds = entity.getMessageIds(); 
		
		for (var x = 0; x < messageIds.length; x++)
		{
			if (messageIds[x] == 'handle-logic')
			{
				this.entities.push(entity);
				break;
			}
		}
	};

	proto['camera-update'] = function(camera){
		this.camera.left = camera.viewportLeft;
		this.camera.top = camera.viewportTop;
		this.camera.width = camera.viewportWidth;
		this.camera.height = camera.viewportHeight;
		if(!this.camera.buffer){
			this.camera.buffer = this.camera.width / 10; // sets a default buffer based on the size of the world units if the buffer was not explicitly set.
		}
	};

	proto['tick'] = proto['logic'] = function(resp){
		var cycles = 0,
		child   = undefined,
		time    = new Date().getTime();
		this.leftoverTime += resp.deltaT;
		cycles = Math.floor(this.leftoverTime / this.stepLength) || 1;

		// This makes the frames smoother, but adds variance into the calculations
		this.message.deltaT = this.leftoverTime / cycles;
		this.leftoverTime = 0;
//		this.leftoverTime -= (cycles * this.stepLength);

		if(!this.message.tick){
			this.message.tick = resp;
		}
		
		//Prevents game lockdown when processing takes longer than time alotted.
		cycles = Math.min(cycles, this.maximumStepsPerTick);
		
		for(var i = 0; i < cycles; i++){
			for (var x = this.entities.length - 1; x > -1; x--)
			{
				child = this.entities[x];
				if(child.alwaysOn || (typeof child.x === 'undefined') || ((child.x >= this.camera.left - this.camera.buffer) && (child.x <= this.camera.left + this.camera.width + this.camera.buffer) && (child.y >= this.camera.top - this.camera.buffer) && (child.y <= this.camera.top + this.camera.height + this.camera.buffer))){
					if(!child.trigger('handle-logic', this.message)){
						this.entities.splice(x, 1);
					}
				}
			}
			this.timeElapsed.name = 'Logic';
			this.timeElapsed.time = new Date().getTime() - time;
			platformer.game.currentScene.trigger('time-elapsed', this.timeElapsed);
			time += this.timeElapsed.time;
			
			this.owner.trigger('check-collision-group', this.message); // If a collision group is attached, make sure collision is processed on each logic tick.
			this.timeElapsed.name = 'Collision';
			this.timeElapsed.time = new Date().getTime() - time;
			platformer.game.currentScene.trigger('time-elapsed', this.timeElapsed);
			time += this.timeElapsed.time;
		}

		this.timeElapsed.time = new Date().getTime() - time;
		platformer.game.currentScene.trigger('time-elapsed', this.timeElapsed);
	};
	
	// This function should never be called by the component itself. Call this.owner.removeComponent(this) instead.
	proto.destroy = function(){
		this.removeListeners(this.listeners);
		this.owner = undefined;
	};
	
	/*********************************************************************************************************
	 * The stuff below here will stay the same for all components. It's BORING!
	 *********************************************************************************************************/
	
	proto.addListeners = function(messageIds){
		for(var message in messageIds) this.addListener(messageIds[message]);
	};

	proto.removeListeners = function(listeners){
		for(var messageId in listeners) this.removeListener(messageId, listeners[messageId]);
	};
	
	proto.addListener = function(messageId, callback){
		var self = this,
		func = callback || function(value, debug){
			self[messageId](value, debug);
		};
		this.owner.bind(messageId, func);
		this.listeners[messageId] = func;
	};

	proto.removeListener = function(boundMessageId, callback){
		this.owner.unbind(boundMessageId, callback);
	};
	
	return component;
})();


/*--------------------------------------------------
 *   camera - ../src/js/standard-components/camera.js
 */
/**
# COMPONENT **camera**
This component controls the game camera deciding where and how it should move. The camera also broadcasts messages when the window resizes or its orientation changes.

## Dependencies:
- **rootElement** property (on entity) - This component requires a DOM element which it uses as the "window" determining the camera's aspect ratio and size.

## Messages

### Listens for:
- **tick, camera** - On a `tick` or `camera` step message, the camera updates its location according to its current state.
  > @param message.deltaT - If necessary, the current camera update function may require the length of the tick to adjust movement rate.
- **follow** - On receiving this message, the camera begins following the requested object.
  > @param message.mode (string) - Required. Can be "locked", "bounding", or "static". "static" suspends following, but the other two settings require that the entity parameter be defined. Also set the bounding area parameters if sending "bounding" as the following method.
  > @param message.entity ([[Entity]]) - The entity that the camera should commence following.
  > @param message.top (number) - The top of a bounding box following an entity.
  > @param message.left (number) - The left of a bounding box following an entity.
  > @param message.width (number) - The width of a bounding box following an entity.
  > @param message.height (number) - The height of a bounding box following an entity.
- **resize, orientationchange** - The camera listens for these events passed along from [[Game]] (who receives them from `window`). It adjusts the camera viewport according to the new size and position of the window.
- **world-loaded** - On receiving this message, the camera updates its world location and size as necessary. An example of this message is triggered by the [[Tiled-Loader]] component.
  > @param message.width (number) - Optional. The width of the loaded world.
  > @param message.height (number) - Optional. The height of the loaded world.
  > @param message.camera ([[Entity]]) - Optional. An entity that the camera should follow in the loaded world.
- **child-entity-added** - If children entities are listening for a `camera-update` message, they are added to an internal list.
  > @param message ([[Entity]]} - Expects an entity as the message object to determine whether to trigger `camera-update` on it.
- **child-entity-removed** - If children are removed from the entity, they are also removed from this component.
  > @param message ([[Entity]]} - Expects an entity as the message object to determine the entity to remove from its list.

### Child Broadcasts:
- **camera-update** - This component fires this message when the position of the camera in the world has changed.
  > @param message.viewportTop (number) - The top of the camera viewport in world coordinates.
  > @param message.viewportLeft (number) - The left of the camera viewport in world coordinates.
  > @param message.viewportWidth (number) - The width of the camera viewport in world coordinates.
  > @param message.viewportHeight (number) - The height of the camera viewport in world coordinates.
  > @param message.scaleX (number) - Number of window pixels that comprise a single world coordinate on the x-axis.
  > @param message.scaleY (number) - Number of window pixels that comprise a single world coordinate on the y-axis.

### Local Broadcasts:
- **camera-update** - This component fires this message when the position of the camera in the world has changed or if the window has been resized.
  > @param message.viewportTop (number) - The top of the camera viewport in world coordinates.
  > @param message.viewportLeft (number) - The left of the camera viewport in world coordinates.
  > @param message.viewportWidth (number) - The width of the camera viewport in world coordinates.
  > @param message.viewportHeight (number) - The height of the camera viewport in world coordinates.
  > @param message.scaleX (number) - Number of window pixels that comprise a single world coordinate on the x-axis.
  > @param message.scaleY (number) - Number of window pixels that comprise a single world coordinate on the y-axis.

## JSON Definition:
    {
      "type": "camera",
      
      "top": 100,
      // Optional number specifying top of viewport in world coordinates
      
      "left": 100,
      // Optional number specifying left of viewport in world coordinates
      
      "width": 100,
      // Optional number specifying width of viewport in world coordinates
      
      "height": 100,
      // Optional number specifying height of viewport in world coordinates
      
      "stretch": true,
      // Optional boolean value that determines whether the camera should stretch the world viewport when window is resized. Defaults to false which maintains the proper aspect ratio.
      
      "scaleWidth": 480
      // Optional. Sets the size in window coordinates at which the world zoom should snap to a larger multiple of pixel size (1,2, 3, etc). This is useful for maintaining a specific game pixel viewport width on pixel art games so pixels use multiples rather than smooth scaling. Default is 0 which causes smooth scaling of the game world in a resizing viewport.
    }
*/
platformer.components['camera'] = (function(){
	var component = function(owner, definition){
		this.owner = owner;
		this.entities = [];
		
		// on resize should the view be stretched or should the world's initial aspect ratio be maintained?
		this.stretch = definition.stretch || false;
		
		// Messages that this component listens for
		this.listeners = [];
		
		this.addListeners(['tick', 'camera', 'follow', 'resize', 'orientationchange', 'world-loaded', 'child-entity-added', 'child-entity-removed']);
		
		//The dimensions of the camera in the window
		this.window = {
			viewportTop: this.owner.rootElement.innerTop,
			viewportLeft: this.owner.rootElement.innerLeft,
			viewportWidth: this.owner.rootElement.offsetWidth,
			viewportHeight: this.owner.rootElement.offsetHeight
		};
		
		//The dimensions of the camera in the game world
		this.world = {
			viewportWidth:       definition.width       || 0,
			viewportHeight:      definition.height      || 0,
			viewportLeft:        definition.left        || 0,
			viewportTop:         definition.top         || 0
		};
		
		this.message = { //defined here so it can be reused
			viewportWidth:  0,
			viewportHeight: 0,
			viewportLeft:   0,
			viewportTop:    0,
			scaleX: 0,
			scaleY: 0
		};

		// on resize should the game snap to certain sizes or should it be fluid?
		// 0 == fluid scaling
		// set the windowWidth multiple that triggers zooming in
		this.scaleWidth = definition.scaleWidth || 0;
		this.resize();
		
		// The dimensions of the entire world
		this.worldWidth  = 0; //definition.worldWidth;
		this.worldHeight = 0; //definition.worldHeight;
		
		this.following = undefined;
		this.state = 'static';//'roaming';
		
		//FOLLOW MODE VARIABLES
		
		//--Bounding
		this.bBBorderX = 0;
		this.bBBorderY = 0;
		this.bBInnerWidth = this.world.viewportWidth - (2 * this.bBBorderX);
		this.bBInnerHeight = this.world.viewportHeight - (2 * this.bBBorderY);
		
		
		this.direction = true;  
	};
	var proto = component.prototype; 

	proto['child-entity-added'] = function(entity){
		var messageIds = entity.getMessageIds(); 
		
		for (var x = 0; x < messageIds.length; x++)
		{
			if (messageIds[x] == 'camera-update')
			{
				this.entities.push(entity);
				break;
			}
		}
	};
	
	proto['child-entity-removed'] = function(entity){
		var x = 0;

		for (x in this.entities) {
			if(this.entities[x] === entity){
				this.entities.splice(x, 1);
				break;
			}
		}
	};
	
	proto['world-loaded'] = function(values){
		this.worldWidth   = this.owner.worldWidth  = values.width;
		this.worldHeight  = this.owner.worldHeight = values.height;
		if(values.camera){
			this.follow(values.camera);
		}
	};
	
	proto['tick'] = proto['camera'] = function(resp){
		var deltaT = resp.deltaT,
		broadcastUpdate = false;
		
		switch (this.state)
		{
		case 'following':
			broadcastUpdate = this.followingFunction(this.following);
			break;
		case 'roaming': //TODO: remove or change this test code, since it currently just goes left to right - DDD
			var speed = .3 * deltaT;
			if (this.direction)
			{
				this.move(this.world.viewportLeft + speed, this.world.viewportTop);
				if (this.worldWidth && (this.world.viewportLeft == this.worldWidth - this.world.viewportWidth)) {
					this.direction = !this.direction;
				}
			} else {
				this.move(this.world.viewportLeft - speed, this.world.viewportTop);
				if (this.worldWidth && (this.world.viewportLeft == 0)) {
					this.direction = !this.direction;
				}
			}
			broadcastUpdate = true;
			break;
		case 'static':
		default:
			break;
		}
		
		if(broadcastUpdate || this.windowResized){
			this.message.viewportLeft   = this.world.viewportLeft;
			this.message.viewportTop    = this.world.viewportTop;
			this.message.viewportWidth  = this.world.viewportWidth;
			this.message.viewportHeight = this.world.viewportHeight;
			this.message.scaleX         = this.windowPerWorldUnitWidth;
			this.message.scaleY         = this.windowPerWorldUnitHeight;

			this.windowResized = false;
			this.owner.trigger('camera-update', this.message);

			if(broadcastUpdate){
				for (var x = this.entities.length - 1; x > -1; x--)
				{
					if(!this.entities[x].trigger('camera-update', this.message)){
						this.entities.splice(x, 1);
					}
				}
			}
		}
	};
	
	proto['resize'] = proto['orientationchange'] = function ()
	{
		//The dimensions of the camera in the window
		this.window.viewportTop = this.owner.rootElement.innerTop;
		this.window.viewportLeft = this.owner.rootElement.innerLeft;
		this.window.viewportWidth = this.owner.rootElement.offsetWidth;
		this.window.viewportHeight = this.owner.rootElement.offsetHeight;

		if(this.scaleWidth){
			this.world.viewportWidth = this.window.viewportWidth / Math.ceil(this.window.viewportWidth / this.scaleWidth);
		}
		
		if(!this.stretch || this.scaleWidth){
			this.world.viewportHeight = this.window.viewportHeight * this.world.viewportWidth / this.window.viewportWidth;
		}
		
		this.worldPerWindowUnitWidth  = this.world.viewportWidth / this.window.viewportWidth;
		this.worldPerWindowUnitHeight = this.world.viewportHeight / this.window.viewportHeight;
		this.windowPerWorldUnitWidth  = this.window.viewportWidth / this.world.viewportWidth;
		this.windowPerWorldUnitHeight = this.window.viewportHeight/ this.world.viewportHeight;
		
		this.windowResized = true;
	};
	
	proto['follow'] = function (def)
	{
		switch (def.mode)
		{
		case 'locked':
			this.state = 'following';
			this.following = def.entity;
			this.followingFunction = this.lockedFollow;
			break;
		case 'bounding':
			this.state = 'following';
			this.following = def.entity;
			this.setBoundingArea(def.top, def.left, def.width, def.height);
			this.followingFunction = this.boundingFollow;
			break;
		case 'static':
		default:
			this.state = 'static';
			this.following = undefined;
			this.followingFunction = undefined;
			break;
		}
		
	};
	
	proto.move = function (newLeft, newTop){
		var moved = this.moveLeft(newLeft);
		moved = this.moveTop(newTop) || moved;
		return moved;
	};
	
	proto.moveLeft = function (newLeft)	{
		if(this.world.viewportLeft !== newLeft){
			if (this.worldWidth < this.world.viewportWidth){
				this.world.viewportLeft = (this.worldWidth - this.world.viewportWidth) / 2;
			} else if (this.worldWidth && (newLeft + this.world.viewportWidth > this.worldWidth)) {
				this.world.viewportLeft = this.worldWidth - this.world.viewportWidth;
			} else if (this.worldWidth && (newLeft < 0)) {
				this.world.viewportLeft = 0; 
			} else {
				this.world.viewportLeft = newLeft;
			}
			return true;
		}
		return false;
	};
	
	proto.moveTop = function (newTop) {
		if(this.world.viewportTop !== newTop){
			if (this.worldHeight < this.world.viewportHeight){
				this.world.viewportTop = (this.worldHeight - this.world.viewportHeight) / 2;
			} else if (this.worldHeight && (newTop + this.world.viewportHeight > this.worldHeight)) {
				this.world.viewportTop = this.worldHeight - this.world.viewportHeight;
			} else if (this.worldHeight && (newTop < 0)) {
				this.world.viewportTop = 0; 
			} else {
				this.world.viewportTop = newTop;
			}
			return true;
		}
		return false;
	};
	
	
	proto.lockedFollow = function (entity)
	{
		return this.move(entity.x - (this.world.viewportWidth / 2), entity.y - (this.world.viewportHeight / 2));
	};
	
	proto.setBoundingArea = function (top, left, width, height)
	{
		this.bBBorderY = (typeof top !== 'undefined') ? top : this.world.viewportHeight  * 0.25;
		this.bBBorderX = (typeof left !== 'undefined') ? left : this.world.viewportWidth * 0.4;
		this.bBInnerWidth = (typeof width !== 'undefined') ? width : this.world.viewportWidth - (2 * this.bBBorderX);
		this.bBInnerHeight = (typeof height !== 'undefined') ? height : this.world.viewportHeight - (2 * this.bBBorderY);
	};
	
	proto.boundingFollow = function (entity)
	{
		var newLeft = undefined;
		var newTop = undefined;
		
		if (entity.x > this.world.viewportLeft + this.bBBorderX + this.bBInnerWidth) 
		{
			newLeft = entity.x -(this.bBBorderX + this.bBInnerWidth);
		} else if (entity.x < this.world.viewportLeft + this.bBBorderX) {
			newLeft = entity.x - this.bBBorderX;
		}
		
		if (entity.y > this.world.viewportTop + this.bBBorderY + this.bBInnerHeight) 
		{
			newTop = entity.y - (this.bBBorderY + this.bBInnerHeight);
		} else if (entity.y < this.world.viewportTop + this.bBBorderY) {
			newTop = entity.y - this.bBBorderY;
		}
		
		if (typeof newLeft !== 'undefined')
		{
			newLeft = this.moveLeft(newLeft);
		}
		
		if (typeof newTop !== 'undefined')
		{
			newTop = this.moveTop(newTop);
		}
		
		return newLeft || newTop;
	};
	
	proto.windowToWorld = function (sCoords)
	{
		var wCoords = [];
		wCoords[0] = Math.round((sCoords[0] - this.window.viewportLeft) * this.worldPerWindowUnitWidth);
		wCoords[1] = Math.round((sCoords[1] - this.window.viewportTop)  * this.worldPerWindowUnitHeight);
		return wCoords; 
	};
	
	proto.worldToWindow = function (wCoords)
	{
		var sCoords = [];
		sCoords[0] = Math.round((wCoords[0] * this.windowPerWorldUnitWidth) + this.window.viewportLeft);
		sCoords[1] = Math.round((wCoords[1] * this.windowPerWorldUnitHeight) + this.window.viewportTop);
		return sCoords;
	};
	
	// This function should never be called by the component itself. Call this.owner.removeComponent(this) instead.
	proto.destroy = function(){
		this.removeListeners(this.listeners);
		this.entities.length = 0;
	};
	
	/*********************************************************************************************************
	 * The stuff below here will stay the same for all components. It's BORING!
	 *********************************************************************************************************/
	
	proto.addListeners = function(messageIds){
		for(var message in messageIds) this.addListener(messageIds[message]);
	};

	proto.removeListeners = function(listeners){
		for(var messageId in listeners) this.removeListener(messageId, listeners[messageId]);
	};
	
	proto.addListener = function(messageId, callback){
		var self = this,
		func = callback || function(value, debug){
			self[messageId](value, debug);
		};
		this.owner.bind(messageId, func);
		this.listeners[messageId] = func;
	};

	proto.removeListener = function(boundMessageId, callback){
		this.owner.unbind(boundMessageId, callback);
	};
	
	return component;
})();


/*--------------------------------------------------
 *   collision-group - ../src/js/standard-components/collision-group.js
 */
/**
# COMPONENT **collision-group**
This component checks for collisions between entities in its group which typically have either a [[Collision-Tiles]] component for tile maps or a [[Collision-Basic]] component for other entities. It uses `entity-container` component messages if triggered to add to its collision list and also listens for explicit add/remove messages (useful in the absence of an `entity-container` component).

## Dependencies:
- [[Handler-Logic]] (on entity) - At the top-most layer, the logic handler triggers `check-collision-group` causing this component to test collisions on all children entities.

## Messages

### Listens for:
- **child-entity-added, add-collision-entity** - On receiving this message, the component checks the entity to determine whether it listens for collision messages. If so, the entity is added to the collision group.
  > @param message ([[Entity]] object) - The entity to be added.
- **child-entity-removed, remove-collision-entity** - On receiving this message, the component looks for the entity in its collision group and removes it.
  > @param message ([[Entity]] object) - The entity to be removed.
- **check-collision-group** - This message causes the component to go through the entities and check for collisions.
  > @param message.camera (object) - Optional. Specifies a region in which to check for collisions. Expects the camera object to contain the following properties: top, left, width, height, and buffer.
- **relocate-group** - This message causes the collision group to trigger `relocate-entity` on entities in the collision group.
  > @param message.x (number) - Required. The new x coordinate.
  > @param message.y (number) - Required. The new y coordinate.

### Child Broadcasts
- **prepare-for-collision** - This message is triggered on collision entities to make sure their axis-aligned bounding box is prepared for collision testing.
- **relocate-entity** - This message is triggered on an entity that has been repositioned due to a solid collision.
- **hit-by-[collision-types specified in collision entities' definitions]** - When an entity collides with an entity of a listed collision-type, this message is triggered on the entity.
  > @param message.entity ([[Entity]]) - The entity with which the collision occurred.
  > @param message.type (string) - The collision type of the other entity.
  > @param message.shape ([[CollisionShape]]) - This is the shape of the other entity that caused the collision.
  > @param message.x (number) - Returns -1, 0, or 1 indicating on which side of this entity the collision occurred: left, neither, or right respectively.
  > @param message.y (number) - Returns -1, 0, or 1 indicating on which side of this entity the collision occurred: top, neither, or bottom respectively.

## JSON Definition:
    {
      "type": "collision-group"
      // This component has no customizable properties.
    }
*/
platformer.components['collision-group'] = (function(){
	//set here to make them reusable objects
	var tempAABB = new platformer.classes.aABB(),
	tempArray1   = [],
	tempArray2   = [],
	tempArray4   = [],
	preciseColls = [],
	triggerMessage = {
		entity: null,
		type:   null,
		shape:  null,
		x: 0,
		y: 0
	},
	entityCollisionMessage = {
		atX: null,
		atY: null,
		aABB: null,
		shape: null
	},
	tileCollisionMessage = {
		atX: null,
		atY: null,
		aABB: null,
		shape: null
	},
	xyPair = {
		x: 0,
		y: 0,
		xMomentum: 0,
		yMomentum: 0,
		relative: false
	},
	triggerCollisionMessages = function(entity, collision, x, y){
		var otherEntity = collision.entity;

		triggerMessage.entity = collision.entity;

		triggerMessage.type   = otherEntity.collisionType;
		triggerMessage.shape  = otherEntity.shape;
		triggerMessage.x      = x;
		triggerMessage.y      = y;
		entity.trigger('hit-by-' + otherEntity.collisionType, triggerMessage);
		
		triggerMessage.entity = entity;
		triggerMessage.type   = entity.collisionType;
		triggerMessage.shape  = entity.shape;
		triggerMessage.x      = -x;
		triggerMessage.y      = -y;
		otherEntity.trigger('hit-by-' + entity.collisionType, triggerMessage);
	},
	triggerTileCollisionMessage = function(entity, shape, x, y){
		triggerMessage.entity = null;
		triggerMessage.type   = 'tiles';
		triggerMessage.shape  = shape;
		triggerMessage.x      = x;
		triggerMessage.y      = y;
		entity.trigger('hit-by-tiles', triggerMessage);
	},
	AABBCollisionX = function (boxX, boxY)
	{
		if(boxX.left   >=  boxY.right)  return false;
		if(boxX.right  <=  boxY.left)   return false;
		return true;
	},
	AABBCollisionY = function (boxX, boxY)
	{
		if(boxX.top    >=  boxY.bottom) return false;
		if(boxX.bottom <=  boxY.top)    return false;
		return true;
	},
	AABBCollision = function (boxX, boxY)
	{
		if(boxX.left   >=  boxY.right)  return false;
		if(boxX.right  <=  boxY.left)   return false;
		if(boxX.top    >=  boxY.bottom) return false;
		if(boxX.bottom <=  boxY.top)    return false;
		return true;
	},
	shapeCollision = function(shapeA, shapeB){
		return true;
	},
	preciseCollision = function (entityA, entityB){
		var i = 0,
		j     = 0,
		aabb  = undefined,
		shapesA = entityA.shapes || entityA.getShapes(),
		shapesB = entityB.shapes || entityB.getShapes();
		
		if((shapesA.length > 1) || (shapesB.length > 1)){
			for (i = 0; i < shapesA.length; i++){
				aabb = shapesA[i].getAABB();
				for (j = 0; j < shapesB.length; j++){
					if((AABBCollision(aabb, shapesB[j].getAABB())) && (shapeCollision(shapesA[i], shapesB[j]))){
						return true; //TODO: return all true instances instead of just the first one in case they need to be resolved in unique ways - DDD
					}
				}
			}
			return false;
		} else {
			return shapeCollision(shapesA[0], shapesB[0]);
		}
	},
	preciseCollisions = function (entities, entity, originalY){
		var shapes = entity.shapes || entity.getShapes();
			aabb   = shapes[0].getAABB();
		
		preciseColls = [];
//		preciseColls.length = 0;
		
		if(originalY){
			for(var i = 0; i < entities.length; i++){
				if(AABBCollisionX(entities[i].getAABB(), aabb) && AABBCollisionY(entities[i].getPreviousAABB(), aabb)){
					preciseColls[preciseColls.length] = entities[i];
				}
			}
		} else {
			for(var i = 0; i < entities.length; i++){
				if(preciseCollision(entities[i], entity, originalY)){
					preciseColls[preciseColls.length] = entities[i];
				}
			}
		}
		
		if (preciseColls.length){
			return preciseColls;
		} else {
			return false;
		}
	},
	checkDirection = function(position, xDirection, yDirection, thisAABB, thatAABB){
		var value = null;
		if (xDirection > 0) {
			value = thatAABB.left - thisAABB.halfWidth;
			if(position !== null){
				value = Math.min(position, value);
			}
		} else if (xDirection < 0) {
			value = thatAABB.right + thisAABB.halfWidth;
			if(position !== null){
				value = Math.max(position, value);
			}
		} else if (yDirection > 0) {
			value = thatAABB.top - thisAABB.halfHeight;
			if(position !== null){
				value = Math.min(position, value);
			}
		} else if (yDirection < 0) {
			value = thatAABB.bottom + thisAABB.halfHeight;
			if(position !== null){
				value = Math.max(position, value);
			}
		}
		return value;
	},
	checkAgainst = function(thisEntity, thisAABB, thatEntity, thatAABB, collisionType, xDirection, yDirection, collision, group){
		var position  = null,
		lastPosition  = null,
		groupPosition = null,
		x = (xDirection?1:null),
		y = (yDirection?1:null),
		collidingEntities = null,
		i        = 0;
		
		if(AABBCollision(thisAABB, thatAABB)){
			if(group){
				collidingEntities = preciseCollisions(group, thatEntity, xDirection);
				if(collidingEntities){
					for(i = 0; i < collidingEntities.length; i++){
						position = checkDirection(position, xDirection, yDirection, collidingEntities[i].getAABB(), thatAABB);
						if (position !== lastPosition){
							if (xDirection > 0) {
								groupPosition = position - (collidingEntities[i].getAABB().x - thisAABB.x);
							} else if (xDirection < 0) {
								groupPosition = position - (collidingEntities[i].getAABB().x - thisAABB.x);
							} else if (yDirection > 0) {
								groupPosition = position - (collidingEntities[i].getAABB().y - thisAABB.y);
							} else if (yDirection < 0) {
								groupPosition = position - (collidingEntities[i].getAABB().y - thisAABB.y);
							}
						}
						lastPosition = position;
					}
					position = groupPosition;
				}
			} else if (preciseCollision(thisEntity, thatEntity)) {
				position = checkDirection(position, xDirection, yDirection, thisAABB, thatAABB);
			}

			if(position !== null){
				if (collision.aABB === null) {
					collision.atX = position * x;
					collision.atY = position * y;
					collision.aABB = thatAABB;
					collision.shape = thatEntity.shapes?thatEntity.shapes[0]:null;
					collision.entity = thatEntity;
					collision.type = thatEntity.collisionType;
				} else if (((xDirection > 0) && (position < collision.atX)) || ((yDirection > 0) && (position < collision.atY))) {
					collision.atX = position * x;
					collision.atY = position * y;
					collision.aABB = thatAABB;
					collision.shape = thatEntity.shapes?thatEntity.shapes[0]:null;
					collision.entity = thatEntity;
					collision.type = thatEntity.collisionType;
				} else if (((xDirection < 0) && (position > collision.atX)) || ((yDirection < 0) && (position > collision.atY))) {
					collision.atX = position * x;
					collision.atY = position * y;
					collision.aABB = thatAABB;
					collision.shape = thatEntity.shapes?thatEntity.shapes[0]:null;
					collision.entity = thatEntity;
					collision.type = thatEntity.collisionType;
				}
			}
			return collision;
		}
	},
	component = function(owner, definition){
		this.owner = owner;
		
		// Messages that this component listens for
		this.listeners = [];
		
		this.addListeners([
		    'child-entity-added',    'add-collision-entity',
		    'child-entity-removed',  'remove-collision-entity',
		    'check-collision-group', 'relocate-group', 'relocate-entity'
		]);  
		//this.toResolve = [];
		
		var self = this;
		this.owner.getCollisionGroup = function(){
			return self.solidEntities;
		};
		this.owner.getCollisionGroupAABB = function(){
			return self.getAABB();
		};
		this.owner.getPreviousCollisionGroupAABB = function(){
			return self.getPreviousAABB();
		};
		
		this.entitiesByType = {};
		this.solidEntities = [];
		this.solidEntitiesLive = [];
		this.softEntities = [];
		this.softEntitiesLive = [];
		this.entitiesByTypeLive = {};
		this.terrain = undefined;
		this.aabb     = new platformer.classes.aABB(this.owner.x, this.owner.y);
		this.prevAABB = new platformer.classes.aABB(this.owner.x, this.owner.y);
		this.lastX = this.owner.getPreviousX?this.owner.getPreviousX():this.owner.x;
		this.lastY = this.owner.getPreviousY?this.owner.getPreviousY():this.owner.y;
		this.xMomentum = 0;
		this.yMomentum = 0;
		
		this.cameraLogicAABB = new platformer.classes.aABB(0, 0);
		this.cameraCollisionAABB = new platformer.classes.aABB(0, 0);
		
		this.unitStepSize = 1000;

		//defined here so we aren't continually recreating new arrays
		this.collisionGroups = [];
		
		this.groupCollisionMessage = {
			entities: this.entitiesByTypeLive,
			terrain: null,
			deltaT: null,
			tick: null,
			camera: null
		};
	};
	var proto = component.prototype; 

	proto['child-entity-added'] = proto['add-collision-entity'] = function(entity){
		var messageIds = entity.getMessageIds(); 
		
		if ((entity.type == 'tile-layer') || (entity.type == 'collision-layer')) { //TODO: probably should have these reference a required function on the obj, rather than an explicit type list since new collision entity map types could be created - DDD
			this.terrain = entity;
			this.groupCollisionMessage.terrain = entity;
		} else {
			for (var x = 0; x < messageIds.length; x++){
				if (messageIds[x] == 'prepare-for-collision'){
					if(!this.entitiesByType[entity.collisionType]){
						this.entitiesByType[entity.collisionType] = [];
						this.entitiesByTypeLive[entity.collisionType] = [];
					}
					this.entitiesByType[entity.collisionType][this.entitiesByType[entity.collisionType].length] = entity;
					if(entity.solidCollisions.length && !entity.immobile){
						this.solidEntities[this.solidEntities.length] = entity;
					}
					if(entity.softCollisions.length){
						this.softEntities[this.softEntities.length] = entity;
					}
					break;
				}
			}
		}
	};
	
	proto['child-entity-removed'] = proto['remove-collision-entity'] = function(entity){
		var x = 0;

		for (x in this.entitiesByType[entity.collisionType]) {
			if(this.entitiesByType[entity.collisionType][x] === entity){
				this.entitiesByType[entity.collisionType].splice(x, 1);
				break;
			}
		}
		
		if(entity.solidCollisions.length){
			for (x in this.solidEntities) {
				if(this.solidEntities[x] === entity){
					this.solidEntities.splice(x, 1);
					break;
				}
			}
		}

		if(entity.softCollisions.length){
			for (x in this.softEntities) {
				if(this.softEntities[x] === entity){
					this.softEntities.splice(x, 1);
					break;
				}
			}
		}
	};
	
	proto['check-collision-group'] = function(resp){
		var entitiesLive = null;
		
		if(resp.camera){
			this.checkCamera(resp.camera);
		}
		
		if(this.owner.x && this.owner.y){ // is this collision group attached to a collision entity?
			if (resp.entities){
				entitiesLive = this.entitiesByTypeLive; //save to reattach later so entities live grouping is not corrupted 
				this.entitiesByTypeLive = resp.entities;
			}
			if (resp.terrain && (this.terrain !== resp.terrain)){
				this.terrain = resp.terrain;
			}
			
			window.currentLoop = 'SubL';
			var goalX = this.owner.x - this.lastX,
			goalY     = this.owner.y - this.lastY;

			this.owner.x = this.lastX;
			this.owner.y = this.lastY;
			this.owner.trigger('prepare-for-collision');
		
			this.checkGroupCollisions(resp);
			this.checkSolidCollisions(resp, false);
	
			this.aabb.reset();
			for (var x = 0; x < this.solidEntitiesLive.length; x++){
				this.aabb.include(((this.solidEntitiesLive[x] !== this.owner) && this.solidEntitiesLive[x].getCollisionGroupAABB)?this.solidEntitiesLive[x].getCollisionGroupAABB():this.solidEntitiesLive[x].getAABB());
			}
	
			this.prevAABB.setAll(this.aabb.x, this.aabb.y, this.aabb.width, this.aabb.height);
			this.aabb.move(this.aabb.x + goalX, this.aabb.y + goalY);
	
			this.checkSoftCollisions(resp);
			
			if (resp.entities){
				this.entitiesByTypeLive = entitiesLive; //from above so entities live grouping is not corrupted 
			}
		} else {
			window.currentLoop = 'Main';
			this.checkGroupCollisions(resp);
			window.currentLoop = 'Main';
			this.checkSolidCollisions(resp, true);
			window.currentLoop = 'Main';
			this.checkSoftCollisions(resp);
		}
	};
	
	proto.getAABB = function(){
		return this.aabb;
	};

	proto.getPreviousAABB = function(){
		return this.prevAABB;
	};
	
	proto.checkCamera = function(camera){
		var i  = 0,
		j      = 0,
		length = 0,
		list   = this.solidEntitiesLive,
		width  = camera.width,
		height = camera.height,
		x      = camera.left + width  / 2,
		y      = camera.top  + height / 2,
		buffer = camera.buffer * 2,
		entities = undefined,
		entity = undefined,
		check  = AABBCollision;
		
		this.cameraLogicAABB.setAll(x, y, width + buffer, height + buffer);
		list.length = 0;
		length = this.solidEntities.length;
		for (; i < length; i++){
			entity = this.solidEntities[i];
			if(entity.alwaysOn || check(entity.getAABB(), this.cameraLogicAABB)){
				list[list.length] = entity;
			}
		}
		list = this.softEntitiesLive;
		list.length = 0;
		length = this.softEntities.length;
		for (i = 0; i < length; i++){
			entity = this.softEntities[i];
			if(entity.alwaysOn || check(entity.getAABB(), this.cameraLogicAABB)){
				list[list.length] = entity;
			}
		}
		
		buffer *= 2;
		this.cameraCollisionAABB.setAll(x, y, width + buffer, height + buffer);
		for (i in this.entitiesByType){
			entities = this.entitiesByType[i];
			list = this.entitiesByTypeLive[i];
			list.length = 0;
			length = entities.length;
			for (j = 0; j < length; j++){
				entity = entities[j];
				if(entity.alwaysOn || check(entity.getAABB(), this.cameraCollisionAABB)){
					list[list.length] = entity;
				}
			}
		}	};

	proto.checkGroupCollisions = function (resp){
		var groups = this.collisionGroups;
		groups.length = 0;
		
		this.groupCollisionMessage.deltaT = resp.deltaT;
		this.groupCollisionMessage.tick = resp.tick;
		this.groupCollisionMessage.camera = resp.camera;
		
		// values inherited from primary world collision group
		if(resp.terrain){
			this.groupCollisionMessage.terrain = resp.terrain;
		}
		if(resp.entities){
			this.groupCollisionMessage.entities = resp.entities;
		}

		for (var x = 0; x < this.solidEntitiesLive.length; x++){
			if(this.solidEntitiesLive[x] !== this.owner){
				if(this.solidEntitiesLive[x].trigger('check-collision-group', this.groupCollisionMessage)){
					this.solidEntitiesLive[x].collisionUnresolved = true;
					groups[groups.length] = this.solidEntitiesLive[x];
				};
			}
		}

		if(groups.length > 0){
			this.resolveCollisionList(groups, true);
		}
	};

	proto.checkSolidCollisions = function (resp, finalMovement){
		var x    = 0,
		entity   = null,
		entities = this.collisionGroups;
		entities.length = 0;
		
		for (x = this.solidEntitiesLive.length - 1; x > -1; x--)
		{
			entity = this.solidEntitiesLive[x];
			if(this.owner !== entity){
				if(entity.trigger('prepare-for-collision', resp)){
					entity.collisionUnresolved = true;
					entities[entities.length] = entity;
/*				} else { // remove the entity because it no longer has a collision handler
					var typeEntities = this.entitiesByType[this.entities[x].collisionType];
					for (y = typeEntities.length - 1; y > -1; y--)
					{
						if(typeEntities[y] === this.entities[x]){
							typeEntities.splice(y, 1);
							break;
						}
					}
					this.entities.splice(x, 1);*/ //temp removed since this line must now find the actual listed entity, not the live entity index
				}
			}
		}
		
		this.resolveCollisionList(entities, false, finalMovement);
	};
	
	proto.resolveCollisionList = function(entities, group, finalMovement){
		for (var x = entities.length - 1; x > -1; x--){
			if(entities[x].collisionUnresolved){
				this.checkSolidEntityCollision(entities[x], group, finalMovement);
				entities[x].collisionUnresolved = false;
			}
		}
	};
	
	proto.checkSolidEntityCollision = function(ent, groupCheck, finalMovement){
		var y    = 0,
		z        = 0,
		initialX = 0,
		initialY = 0,
		xy       = xyPair,
		unitStepSize = this.unitStepSize,
		collisionGroup = ((groupCheck && ent.getCollisionGroup)?ent.getCollisionGroup():null),
		checkAABBCollision = AABBCollision;
		
		var currentAABB = groupCheck?ent.getCollisionGroupAABB():ent.getAABB();
		var previousAABB = groupCheck?ent.getPreviousCollisionGroupAABB():ent.getPreviousAABB();//ent.getAABB().getCopy().move(ent.getPreviousX() + ent.getShapes()[0].getXOffset(), ent.getPreviousY() + ent.getShapes()[0].getYOffset());
		
		var sweepTop = Math.min(currentAABB.top, previousAABB.top);
		var sweepBottom = Math.max(currentAABB.bottom, previousAABB.bottom);
		var sweepHeight = sweepBottom - sweepTop;
		var sweepLeft = Math.min(currentAABB.left, previousAABB.left);
		var sweepRight = Math.max(currentAABB.right, previousAABB.right);
		var sweepWidth = sweepRight - sweepLeft;
		var sweepX = sweepLeft + (sweepWidth / 2);
		var sweepY = sweepTop + (sweepHeight / 2); 
		var sweepAABB = tempAABB.setAll(sweepX, sweepY, sweepWidth, sweepHeight);
		var otherEntity = undefined;
		var include = false;
		
		var potentialTiles = tempArray1,
		potentialsEntities = tempArray2,
		collisionsY        = tempArray4;
		potentialTiles.length = 0;
		potentialsEntities.length = 0;
		collisionsY.length = 0;

		for (y = 0; y < ent.solidCollisions.length; y++) {
			if(this.entitiesByTypeLive[ent.solidCollisions[y]]){
				for(z = 0; z < this.entitiesByTypeLive[ent.solidCollisions[y]].length; z++){
					include = true;
					otherEntity = this.entitiesByTypeLive[ent.solidCollisions[y]][z];
					if(collisionGroup){
						for(var i in collisionGroup){
							if(otherEntity === collisionGroup[i]){
								include = false;
							}
						}
					} else if (otherEntity === ent){
						include = false;
					}
					if(include && (checkAABBCollision(sweepAABB, otherEntity.collisionUnresolved?otherEntity.getPreviousAABB():otherEntity.getAABB()))) {
						potentialsEntities[potentialsEntities.length] = this.entitiesByTypeLive[ent.solidCollisions[y]][z];
						connectedToGroup = true; // still touching another entity
					}
				}
			} else if (this.terrain && (ent.solidCollisions[y] === 'tiles')){
				potentialTiles = this.terrain.getTiles(sweepAABB);
			}
		}
		
		
		initialX  = previousAABB.x;//ent.getPreviousX();
		var xPos  = initialX;
		var xGoal = currentAABB.x;//ent.x;
		var xStep  = (xPos < xGoal) ? unitStepSize : -unitStepSize;
		var finalX = undefined; 
		var aabbOffsetX = groupCheck?0:(previousAABB.x - ent.getPreviousX());//previousAABB.x - initialX;
		
		initialY  = previousAABB.y;//ent.getPreviousY();
		var yPos  = initialY;
		var yGoal = currentAABB.y;//ent.y;
		var yStep  = (yPos < yGoal) ? unitStepSize : -unitStepSize;
		var finalY = undefined;
		var aabbOffsetY = groupCheck?0:(previousAABB.y - ent.getPreviousY());//previousAABB.y - initialY;

		var tileCollision    = tileCollisionMessage;
		var entityCollision  = entityCollisionMessage;
		
		//////////////////////////////////////////////////////////////////////
		//MOVE IN THE X DIRECTION
		//////////////////////////////////////////////////////////////////////
		tileCollision.aABB   = null;
		tileCollision.atX    = null;
		tileCollision.atY    = null;
		entityCollision.aABB = null;
		entityCollision.atX  = null;
		entityCollision.atY  = null;

		while (xPos != xGoal && (potentialTiles.length || potentialsEntities.length)){
			if (Math.abs(xGoal - xPos) < unitStepSize)
			{
				if(collisionGroup){
					for(var i in collisionGroup){
						collisionGroup[i].x += xGoal - xPos;
						collisionGroup[i].trigger('prepare-for-collision');
					}
				}
				xPos = xGoal;
			} else {
				if(collisionGroup){
					for(var i in collisionGroup){
						collisionGroup[i].x += xStep;
						collisionGroup[i].trigger('prepare-for-collision');
					}
				}
				xPos += xStep;
			}
			previousAABB.move(xPos, yPos);
			
			//CHECK AGAINST TILES
			for (var t = 0; t < potentialTiles.length; t++) {
				checkAgainst(ent, previousAABB, potentialTiles[t], potentialTiles[t].shapes[0].getAABB(), 'tiles', xStep, 0, tileCollision, collisionGroup);
			}
			
			//CHECK AGAINST SOLID ENTITIES
			for (var u = 0; u < potentialsEntities.length; u++) {
				checkAgainst(ent, previousAABB, potentialsEntities[u], potentialsEntities[u].collisionUnresolved?potentialsEntities[u].getPreviousAABB():potentialsEntities[u].getAABB(), potentialsEntities[u].collisionType, xStep, 0, entityCollision, collisionGroup);
			}
			
			if((entityCollision.atX !== null) && (((xStep > 0) && (!tileCollision.aABB || (entityCollision.atX < tileCollision.atX))) || ((xStep < 0) && (!tileCollision.aABB || (entityCollision.atX > tileCollision.atX))))){
				if(!groupCheck){
					triggerCollisionMessages(ent, entityCollision, xStep / Math.abs(xStep), 0);
				}
					
				if(((entityCollision.atX > initialX) && (xStep > 0)) || ((entityCollision.atX < initialX) && (xStep < 0))){
					finalX = entityCollision.atX;
				} else {
					finalX = initialX;
				}
			} else if(typeof finalX === 'undefined' && tileCollision.aABB){
				if(!groupCheck){
					triggerTileCollisionMessage(ent, tileCollision.shape, xStep / Math.abs(xStep), 0);
				}

				if(((tileCollision.atX > initialX) && (xStep > 0)) || ((tileCollision.atX < initialX) && (xStep < 0))){
					finalX = tileCollision.atX;
				} else {
					finalX = initialX;
				}
			}
			
			if(typeof finalX !== 'undefined')
			{
				break;
			}
		}
		
		if(typeof finalX === 'undefined')
		{
			
			finalX = xGoal;
		}
		
		//////////////////////////////////////////////////////////////////////
		//MOVE IN THE Y DIRECTION
		//////////////////////////////////////////////////////////////////////
		tileCollision.aABB   = null;
		tileCollision.atX    = null;
		tileCollision.atY    = null;
		entityCollision.aABB = null;
		entityCollision.atX  = null;
		entityCollision.atY  = null;

		while (yPos != yGoal && (potentialTiles.length || potentialsEntities.length))
		{
			if (Math.abs(yGoal - yPos) < unitStepSize)
			{
				if(collisionGroup){
					for(var i in collisionGroup){
						collisionGroup[i].y += yGoal - yPos;
						collisionGroup[i].trigger('prepare-for-collision');
					}
				}
				yPos = yGoal;
			} else {
				if(collisionGroup){
					for(var i in collisionGroup){
						collisionGroup[i].y += yStep;
						collisionGroup[i].trigger('prepare-for-collision');
					}
				}
				yPos += yStep;
			}
			previousAABB.move(finalX, yPos);
			
			//CHECK AGAINST TILES
			for (var t = 0; t < potentialTiles.length; t++) {
				checkAgainst(ent, previousAABB, potentialTiles[t], potentialTiles[t].shapes[0].getAABB(), 'tiles', 0, yStep, tileCollision, collisionGroup);
			}
			
			//CHECK AGAINST SOLID ENTITIES
			for (var u = 0; u < potentialsEntities.length; u++) {
				checkAgainst(ent, previousAABB, potentialsEntities[u], potentialsEntities[u].collisionUnresolved?potentialsEntities[u].getPreviousAABB():potentialsEntities[u].getAABB(), potentialsEntities[u].collisionType, 0, yStep, entityCollision, collisionGroup);
			}
			
			if((entityCollision.atY !== null) && (((yStep > 0) && (!tileCollision.aABB || (entityCollision.atY < tileCollision.atY))) || ((yStep < 0) && (!tileCollision.aABB || (entityCollision.atY > tileCollision.atY))))){
				if(!groupCheck){
					triggerCollisionMessages(ent, entityCollision, 0, yStep / Math.abs(yStep));
				}
					
				if(((entityCollision.atY > initialY) && (yStep > 0)) || ((entityCollision.atY < initialY) && (yStep < 0))){
					finalY = entityCollision.atY;
				} else {
					finalY = initialY;
				}
			} else if(typeof finalY === 'undefined' && tileCollision.aABB){
				if(!groupCheck){
					triggerTileCollisionMessage(ent, tileCollision.shape, 0, yStep / Math.abs(yStep));
				}

				if(((tileCollision.atY > initialY) && (yStep > 0)) || ((tileCollision.atY < initialY) && (yStep < 0))){
					finalY = tileCollision.atY;
				} else {
					finalY = initialY;
				}
			}
			
			if(typeof finalY !== 'undefined')
			{
				break;
			}
		}
		
		
		if(typeof finalY === 'undefined')
		{
			finalY = yGoal;
		}

		xy.relative = false;
		if(groupCheck){
			xy.xMomentum = xGoal - finalX;
			xy.yMomentum = yGoal - finalY;
			xy.x = finalX - initialX;
			xy.y = finalY - initialY;
			ent.trigger('relocate-group', xy);
		} else {
			xy.x = finalX - aabbOffsetX;
			xy.y = finalY - aabbOffsetY;
			if(finalMovement){
				xy.xMomentum = 0;
				xy.yMomentum = 0;
			} else {
				xy.xMomentum = xGoal - finalX;
				xy.yMomentum = yGoal - finalY;
			}
			ent.trigger('relocate-entity', xy);
		}
	};
	
	proto.checkSoftCollisions = function (resp)
	{
		var otherEntity = undefined,
		ent = undefined,
		message = triggerMessage,
		x   = 0,
		y   = 0,
		z   = 0,
		checkAABBCollision = AABBCollision;

		message.x = 0;
		message.y = 0;
		
		for(x = 0; x < this.softEntitiesLive.length; x++){
			ent = this.softEntitiesLive[x];
			for (y = 0; y < ent.softCollisions.length; y++){
				if(this.entitiesByTypeLive[ent.softCollisions[y]]){
					for(z = 0; z < this.entitiesByTypeLive[ent.softCollisions[y]].length; z++){
						otherEntity = this.entitiesByTypeLive[ent.softCollisions[y]][z];
						if((otherEntity !== ent) && (checkAABBCollision(ent.getAABB(), otherEntity.getAABB()))) {
							if (preciseCollision(ent, otherEntity)){
								message.entity = otherEntity;
								message.type   = otherEntity.collisionType;
								message.shape  = otherEntity.shape;
								ent.trigger('hit-by-' + otherEntity.collisionType, message);
							}
						}
					}
				}
			}
		}
	};
	
	proto['relocate-group'] = function(resp){
		var xy = xyPair;
		this.xMomentum = resp.xMomentum;
		this.yMomentum = resp.yMomentum;
		xy.x = resp.x;
		xy.y = resp.y;
		xy.xMomentum = 0;
		xy.yMomentum = 0;
		xy.relative = true;
		for (var i = 0; i < this.solidEntities.length; i++){
			this.solidEntities[i].trigger('relocate-entity', xy);
		}
		this.aabb.reset();
		for (var x = 0; x < this.solidEntities.length; x++){
			this.aabb.include(((this.solidEntities[x] !== this.owner) && this.solidEntities[x].getCollisionGroupAABB)?this.solidEntities[x].getCollisionGroupAABB():this.solidEntities[x].getAABB());
		}
		this.resolveMomentum();
	};
	
	proto['relocate-entity'] = function(resp){
		this.lastX = this.owner.x;
		this.lastY = this.owner.y;
	};
	
	proto.resolveMomentum = function(){
		for (var x = 0; x < this.solidEntities.length; x++){
			this.solidEntities[x].trigger('resolve-momentum');
			this.solidEntities[x].x += this.xMomentum;
			this.solidEntities[x].y += this.yMomentum;
		}
		this.xMomentum = 0;
		this.yMomentum = 0;
	};
	
	// This function should never be called by the component itself. Call this.owner.removeComponent(this) instead.
	proto.destroy = function(){
		this.removeListeners(this.listeners);
		this.solidEntities.length = 0;
		this.softEntities.length = 0;
		for (var i in this.entitiesByType){
			this.entitiesByType[i].length = 0;
		}
	};
	
	/*********************************************************************************************************
	 * The stuff below here will stay the same for all components. It's BORING!
	 *********************************************************************************************************/
	
	proto.addListeners = function(messageIds){
		for(var message in messageIds) this.addListener(messageIds[message]);
	};

	proto.removeListeners = function(listeners){
		for(var messageId in listeners) this.removeListener(messageId, listeners[messageId]);
	};
	
	proto.addListener = function(messageId, callback){
		var self = this,
		func = callback || function(value, debug){
			self[messageId](value, debug);
		};
		this.owner.bind(messageId, func);
		this.listeners[messageId] = func;
	};

	proto.removeListener = function(boundMessageId, callback){
		this.owner.unbind(boundMessageId, callback);
	};
	
	return component;
})();













/*--------------------------------------------------
 *   audio - ../src/js/standard-components/audio.js
 */
/**
# COMPONENT **audio**
This component plays audio. Audio is played in one of two ways, by triggering specific messages defined in the audio component definition or using an audio map which plays sounds when the entity enters specified states (like render-animation).

## Dependencies:
- [createjs.SoundJS] [link1] - This component requires the SoundJS library to be included for audio functionality.
- [[Handler-Render]] (on entity's parent) - This component listens for a render "tick" message in order to stop audio clips that have a play length set.

## Messages

### Listens for:
- **handle-render** - On each `handle-render` message, this component checks its list of playing audio clips and stops any clips whose play length has been reached.
  > @param message.deltaT (number) - uses the value of deltaT (time since last `handle-render`) to track progess of the audio clip and stop clip if play length has been reached.
- **audio-mute-toggle** - On receiving this message, the audio will mute if unmuted, and unmute if muted.
  > @param message (string) - If a message is included, a string is expected that specifies an audio id, and that particular sound instance is toggled. Otherwise all audio is toggled from mute to unmute or vice versa.
- **audio-mute** - On receiving this message all audio will mute, or a particular sound instance will mute if an id is specified.
  > @param message (string) - If a message is included, a string is expected that specifies an audio id, and that particular sound instance is muted.
- **audio-unmute** - On receiving this message all audio will unmute, or a particular sound instance will unmute if an id is specified.
  > @param message (string) - If a message is included, a string is expected that specifies an audio id, and that particular sound instance is unmuted.
- **logical-state** - This component listens for logical state changes and tests the current state of the entity against the audio map. If a match is found, the matching audio clip is played.
  > @param message (object) - Required. Lists various states of the entity as boolean values. For example: {jumping: false, walking: true}. This component retains its own list of states and updates them as `logical-state` messages are received, allowing multiple logical components to broadcast state messages.
- **[Messages specified in definition]** - Listens for additional messages and on receiving them, begins playing corresponding audio clips. Audio play message can optionally include several parameters, many of which correspond with [SoundJS play parameters] [link2].
  > @param message.interrupt (string) - Optional. Can be "any", "early", "late", or "none". Determines how to handle the audio when it's already playing but a new play request is received. Default is "any".
  > @param message.delay (integer) - Optional. Time in milliseconds to wait before playing audio once the message is received. Default is 0.
  > @param message.offset (integer) - Optional. Time in milliseconds determining where in the audio clip to begin playback. Default is 0.
  > @param message.length (integer) - Optional. Time in milliseconds to play audio before stopping it. If 0 or not specified, play continues to the end of the audio clip.
  > @param message.loop (integer) - Optional. Determines how many more times to play the audio clip once it finishes. Set to -1 for an infinite loop. Default is 0.
  > @param message.volume (float) - Optional. Used to specify how loud to play audio on a range from 0 (mute) to 1 (full volume). Default is 1.
  > @param message.pan (float) - Optional. Used to specify the pan of audio on a range of -1 (left) to 1 (right). Default is 0.

## JSON Definition:
    {
      "type": "audio",
      
      "audioMap":{
      // Required. Use the audioMap property object to map messages triggered with audio clips to play. At least one audio mapping should be included for audio to play.
      
        "message-triggered": "audio-id",
        // This simple form is useful to listen for "message-triggered" and play "audio-id" using default audio properties.
        
        "another-message": {
        // To specify audio properties, instead of mapping the message to an audio id string, map it to an object with one or more of the properties shown below. Many of these properties directly correspond to [SoundJS play parameters] (http://www.createjs.com/Docs/SoundJS/SoundJS.html#method_play).
        
          "sound": "another-audio-id",
          // Required. This is the audio clip to play when "another-message" is triggered.
          
          "interrupt": "none",
          // Optional. Can be "any", "early", "late", or "none". Determines how to handle the audio when it's already playing but a new play request is received. Default is "any".
          
          "delay": 500,
          // Optional. Time in milliseconds to wait before playing audio once the message is received. Default is 0.
          
          "offset": 1500,
          // Optional. Time in milliseconds determining where in the audio clip to begin playback. Default is 0.
          
          "length": 2500,
          // Optional. Time in milliseconds to play audio before stopping it. If 0 or not specified, play continues to the end of the audio clip.

          "loop": 4,
          // Optional. Determines how many more times to play the audio clip once it finishes. Set to -1 for an infinite loop. Default is 0.
          
          "volume": 0.75,
          // Optional. Used to specify how loud to play audio on a range from 0 (mute) to 1 (full volume). Default is 1.
          
          "pan": -0.25
          // Optional. Used to specify the pan of audio on a range of -1 (left) to 1 (right). Default is 0.
        }
      }
    }

[link1]: http://www.createjs.com/Docs/SoundJS/module_SoundJS.html
[link2]: http://www.createjs.com/Docs/SoundJS/SoundJS.html#method_play
*/
platformer.components['audio'] = (function(){
	var defaultSettings = {
		interrupt: createjs.SoundJS.INTERRUPT_ANY, //INTERRUPT_ANY, INTERRUPT_EARLY, INTERRUPT_LATE, or INTERRUPT_NONE
		delay:     0,
		offset:    0,
		loop:      0,
		volume:    1,
		pan:       0,
		length:    0
	},
	playSound = function(soundDefinition){
		var sound = '',
		attributes = undefined;
		if(typeof soundDefinition === 'string'){
			sound      = soundDefinition;
			attributes = {};
		} else {
			sound      = soundDefinition.sound;
			attributes = soundDefinition;
		}
		if(platformer.settings.assets[sound].data){
			for(var item in platformer.settings.assets[sound].data){
				attributes[item] = attributes[item] || platformer.settings.assets[sound].data[item];
			}
		}
		if(platformer.settings.assets[sound].assetId){
			sound = platformer.settings.assets[sound].assetId;
		}
		return function(value){
			var audio = undefined,
			length    = 0;
			value = value || attributes;
			if(value){
				var interrupt = value.interrupt || attributes.interrupt || defaultSettings.interrupt,
				delay         = value.delay     || attributes.delay  || defaultSettings.delay,
				offset        = value.offset    || attributes.offset || defaultSettings.offset,
				loop          = value.loop      || attributes.loop   || defaultSettings.loop,
				volume        = (typeof value.volume !== 'undefined')? value.volume: ((typeof attributes.volume !== 'undefined')? attributes.volume: defaultSettings.volume),
				pan           = value.pan       || attributes.pan    || defaultSettings.pan;
				length        = value.length    || attributes.length || defaultSettings.length;
				
				audio = createjs.SoundJS.play(sound, interrupt, delay, offset, loop, volume, pan);
			} else {
				audio = createjs.SoundJS.play(sound, defaultSettings.interrupt, defaultSettings.delay, defaultSettings.offset, defaultSettings.loop, defaultSettings.volume, defaultSettings.pan);
			}

			if(audio.playState === 'playFailed'){
				if(this.owner.debug){
					console.warn('Unable to play "' + sound + '".', audio);
				}
			} else {
				if(length){ // Length is specified so we need to turn off the sound at some point.
					this.timedAudioClips.push({length: length, progress: 0, audio: audio});
				}
			}
		};
	},
	createTest = function(testStates, audio){
		var states = testStates.replace(/ /g, '').split(',');
		if(testStates === 'default'){
			return function(state){
				return testStates;
			};
		} else {
			return function(state){
				for(var i = 0; i < states.length; i++){
					if(!state[states[i]]){
						return false;
					}
				}
				return testStates;
			};
		}
	},
	component = function(owner, definition){
		this.owner = owner;
		this.timedAudioClips = [],
		
		// Messages that this component listens for
		this.listeners = [];
		this.addListeners(['handle-render', 'audio-mute-toggle', 'audio-mute', 'audio-unmute', 'logical-state']);

		this.state = {};
		this.stateChange = false;
		this.currentState = false;

		if(definition.audioMap){
			this.checkStates = [];
			for (var key in definition.audioMap){
				this.addListener(key);
				this[key] = playSound(definition.audioMap[key]);
				this.checkStates.push(createTest(key, definition.audioMap[key]));
			}
		}
	};
	var proto = component.prototype;
	
	proto['handle-render'] = function(resp){
		if (this.destroyMe && this.timedAudioClips.length == 0)
		{
			this.timedAudioClips = undefined;
			this.removeListeners(this.listeners);
		} else {
			var i     = 0,
			audioClip = undefined;
			newArray  = undefined;
			if(this.timedAudioClips.length){
				newArray = [];
				for (i in this.timedAudioClips){
					audioClip = this.timedAudioClips[i];
					audioClip.progress += resp.deltaT;
					if(audioClip.progress >= audioClip.length){
						audioClip.audio.stop();
					} else {
						newArray.push(audioClip);
					}
				}
				this.timedAudioClips = newArray;
			}

			i = 0;
			if(this.stateChange){
				if(this.checkStates){
					this.currentState = false;
					for(; i < this.checkStates.length; i++){
						audioClip = this.checkStates[i](this.state);
						if(audioClip){
							this.currentState = audioClip;
							break;
						}
					}
				}
				this.stateChange = false;
			}
			
			if(this.currentState){
				this[this.currentState]();
			}
		}
	};

	proto['logical-state'] = function(state){
		for(var i in state){
			if(this.state[i] !== state[i]){
				this.stateChange = true;
				this.state[i] = state[i];
			}
		}
	};
	
	proto['audio-mute-toggle'] = function(sound){
		if(sound && (typeof sound === 'string')){
			if(createjs.SoundJS.getInstanceById(sound)){
				createjs.SoundJS.setMute(!createjs.SoundJS.getInstanceById(sound).muted, sound);
			}
		} else {
			createjs.SoundJS.setMute(!createjs.SoundJS.muted);
		}
	};
	
	proto['audio-mute'] = function(sound){
		createjs.SoundJS.setMute(true, sound);
	};
	
	proto['audio-unmute'] = function(sound){
		createjs.SoundJS.setMute(false, sound);
	};
	
	// This function should never be called by the component itself. Call this.owner.removeComponent(this) instead.
	proto.destroy = function(){
		//Handling things in 'render'
		this.destroyMe = true;
	};
	
	/*********************************************************************************************************
	 * The stuff below here will stay the same for all components. It's BORING!
	 *********************************************************************************************************/

	proto.addListeners = function(messageIds){
		for(var message in messageIds) this.addListener(messageIds[message]);
	};

	proto.removeListeners = function(listeners){
		for(var messageId in listeners) this.removeListener(messageId, listeners[messageId]);
	};
	
	proto.addListener = function(messageId, callback){
		var self = this,
		func = callback || function(value, debug){
			self[messageId](value, debug);
		};
		this.owner.bind(messageId, func);
		this.listeners[messageId] = func;
	};

	proto.removeListener = function(boundMessageId, callback){
		this.owner.unbind(boundMessageId, callback);
	};
	
	return component;
})();


/*--------------------------------------------------
 *   broadcast-events - ../src/js/standard-components/broadcast-events.js
 */
/**
# COMPONENT **broadcast-events**
This component listens for specified local entity messages and re-broadcasts them on itself, its parent entity, or at the game level.
> **Note:** Make sure that this component is never set up to receive and broadcast identical messages or an infinite loop will result, since it will receive the same message it sent.

## Dependencies:
- [[Entity-Container]] (on entity's parent) - This component can broadcast messages to its parent; `this.parent` is commonly specified by being a member of an entity container.

## Messages

### Listens for:
- **[Messages specified in definition]** - Listens for specified messages and on receiving them, re-triggers them as new messages.
  > @param message (object) - accepts a message object that it will include in the new message to be triggered.

### Local Broadcasts:
- **[Messages specified in definition]** - Listens for specified messages and on receiving them, re-triggers them as new messages on the entity.
  > @param message (object) - sends the message object received by the original message.

### Parent Broadcasts:
- **[Messages specified in definition]** - Listens for specified messages and on receiving them, re-triggers them as new messages on the entity's parent if one exists.
  > @param message (object) - sends the message object received by the original message.

### Game Broadcasts:
- **[Messages specified in definition]** - Listens for specified messages and on receiving them, re-triggers them as new messages at the top game level.
  > @param message (object) - sends the message object received by the original message.

## JSON Definition:
    {
      "type": "broadcast-events",
      
      // One of the following event mappings must be specified: "events", "parentEvents", or "renameEvents".
      
      "events": {
      // Optional: Maps local messages to trigger global game messages. At least one of the following mappings should be included.
        
        "local-message-1": "global-game-message",
        // On receiving "local-message-1", triggers "global-game-message" at the game level.
        
        "local-message-2": ["multiple", "messages", "to-trigger"]
        // On receiving "local-message-2", triggers each message in the array in sequence at the game level.
      }
      
      "parentEvents": {
      // Optional: Maps local messages to trigger messages on the entity's parent. At least one of the following mappings should be included.
        
        "local-message-3": "parent-message",
        // On receiving "local-message-3", triggers "parent-message" on the entity's parent.
        
        "local-message-4": ["multiple", "messages", "to-trigger"]
        // On receiving "local-message-4", triggers each message in the array in sequence on the entity's parent.
      }
      
      "renameEvents": {
      // Optional: Maps local messages to trigger alternative messages on the entity itself. This can be useful as a basic fill-in for a logic component to translate an outgoing message from one component into an incoming message for another. At least one of the following mappings should be included.
        
        "local-message-5": "another-local-message",
        // On receiving "local-message-5", triggers "another-local-message" on the entity itself.
        
        "local-message-6": ["multiple", "messages", "to-trigger"]
        // On receiving "local-message-6", triggers each message in the array in sequence on the entity itself.
      }
    }
*/
platformer.components['broadcast-events'] = (function(){
	var gameBroadcast = function(event){
		if(typeof event === 'string'){
			return function(value, debug){
				platformer.game.currentScene.trigger(event, value, debug);
			};
		} else {
			return function(value, debug){
				for (var e in event){
					platformer.game.currentScene.trigger(event[e], value, debug);
				}
			};
		}
	};
	
	var parentBroadcast = function(event){
		if(typeof event === 'string'){
			return function(value, debug){
				if(this.owner.parent)
				{
					this.owner.parent.trigger(event, value, debug);
				}
				
			};
		} else {
			return function(value, debug){
				for (var e in event){
					this.owner.parent.trigger(event[e], value, debug);
				}
			};
		}
	};
	
	var entityBroadcast = function(event){
		if(typeof event === 'string'){
			return function(value, debug){
				this.owner.trigger(event, value, debug);
			};
		} else {
			return function(value, debug){
				for (var e in event){
					this.owner.trigger(event[e], value, debug);
				}
			};
		}
	};
	
	var component = function(owner, definition){
		this.owner = owner;

		// Messages that this component listens for and then broadcasts to all layers.
		this.listeners = [];
		if(definition.events){
			for(var event in definition.events){
				this[event] = gameBroadcast(definition.events[event]);
				this.addListener(event);
			}
		}
		
		if(definition.parentEvents){
			for(var event in definition.parentEvents){
				this[event] = parentBroadcast(definition.parentEvents[event]);
				this.addListener(event);
			}
		}
		
		// Messages that this component listens for and then triggers on itself as a renamed message - useful as a logic place-holder for simple entities.
		if(definition.renameEvents){
			for(var event in definition.renameEvents){
				this[event] = entityBroadcast(definition.renameEvents[event]);
				this.addListener(event);
			}
		}
	};
	var proto = component.prototype;
	
	// This function should never be called by the component itself. Call this.owner.removeComponent(this) instead.
	proto.destroy = function(){
		this.removeListeners(this.listeners);
	};
	
	/*********************************************************************************************************
	 * The stuff below here will stay the same for all components. It's BORING!
	 *********************************************************************************************************/

	proto.addListeners = function(messageIds){
		for(var message in messageIds) this.addListener(messageIds[message]);
	};

	proto.removeListeners = function(listeners){
		for(var messageId in listeners) this.removeListener(messageId, listeners[messageId]);
	};
	
	proto.addListener = function(messageId, callback){
		var self = this,
		func = callback || function(value, debug){
			self[messageId](value, debug);
		};
		this.owner.bind(messageId, func);
		this.listeners[messageId] = func;
	};

	proto.removeListener = function(boundMessageId, callback){
		this.owner.unbind(boundMessageId, callback);
	};
	
	return component;
})();


/*--------------------------------------------------
 *   change-scene - ../src/js/standard-components/change-scene.js
 */
/**
# COMPONENT **change-scene**
This component allows the entity to initiate a change from the current scene to another scene.

## Messages

### Listens for:
- **new-scene** - On receiving this message, a new scene is loaded according to provided parameters or previously determined component settings.
  > @param message.scene (string) - This is a label corresponding with a predefined scene.
  > @param message.transition (string) - This can be "instant" or "fade-to-black". Defaults to an instant transition.

## JSON Definition:
    {
      "type": "change-scene",
      
      "scene": "scene-menu",
      // Optional (but must be provided by a "change-scene" parameter if not defined here). This causes the "new-scene" trigger to load this scene.
      
      "transition": "fade-to-black",
      // Optional. This can be "instant" or "fade-to-black". Defaults to an "instant" transition.
    }
*/
platformer.components['change-scene'] = (function(){
	var component = function(owner, definition){
		this.owner = owner;
		
		// Messages that this component listens for
		this.listeners = [];

		this.scene = this.owner.scene || definition.scene;
		this.transition = this.owner.transition || definition.transition || 'instant';
		
		this.addListeners(['new-scene']);
	};
	var proto = component.prototype;
	
	proto['new-scene'] = function(response){
		var resp   = response || this,
		scene      = resp.scene || this.scene,
		transition = resp.transition || this.transition;

		platformer.game.loadScene(scene, transition);
	};
	
	// This function should never be called by the component itself. Call this.owner.removeComponent(this) instead.
	proto.destroy = function(){
		this.removeListeners(this.listeners);
		this.owner = undefined;
	};
	
	/*********************************************************************************************************
	 * The stuff below here will stay the same for all components. It's BORING!
	 *********************************************************************************************************/

	proto.addListeners = function(messageIds){
		for(var message in messageIds) this.addListener(messageIds[message]);
	};

	proto.removeListeners = function(listeners){
		for(var messageId in listeners) this.removeListener(messageId, listeners[messageId]);
	};
	
	proto.addListener = function(messageId, callback){
		var self = this,
		func = callback || function(value, debug){
			self[messageId](value, debug);
		};
		this.owner.bind(messageId, func);
		this.listeners[messageId] = func;
	};

	proto.removeListener = function(boundMessageId, callback){
		this.owner.unbind(boundMessageId, callback);
	};
	
	return component;
})();


/*--------------------------------------------------
 *   destroy-me - ../src/js/standard-components/destroy-me.js
 */
/**
# COMPONENT **destroy-me**
This component will cause the entity to remove itself from its parent upon receiving a given message.

## Dependencies:
- [[Entity-Container]] (on entity's parent) - This component requires the entity to have `entity.parent` defined as the entity containing this entity. This is commonly provided by an [[Entity-Container]] on the parent entity.

## Messages

### Listens for:
- **destroy-me** - On receiving this message, the component removes this entity from the parent, which typically destroys the entity.
- **[Message specified in definition]** - An alternative message can be specified in the JSON definition that will also cause the entity's removal.

## JSON Definition:
    {
      "type": "destroy-me",
      
      "message": "hit-by-wrench",
      // Optional: If specified, this message will cause the entity to be removed in addition to a "destroy-me" message.
      
      "delay": 250
      // Optional: Time in milliseconds before entity should be destroyed. If not defined, it is instantaneous.
    }
*/
platformer.components['destroy-me'] = (function(){
	var component = function(owner, definition){
		this.owner = owner;
		
		// Messages that this component listens for
		this.listeners = [];
		this.addListeners(['destroy-me']);
		
		if(definition.message){
			this.addListener(definition.message);
			this[definition.message] = this['destroy-me'];
		}
		
		this.destroyed = false;
		this.delay = definition.delay || 0;
	};
	var proto = component.prototype;
	
	proto['destroy-me'] = function(){
		var self = this;
		if(!this.destroyed){
			setTimeout(function(){
				self.owner.parent.removeEntity(self.owner);
			}, this.delay);
		}
		this.destroyed = true;
	};
	
	// This function should never be called by the component itself. Call this.owner.removeComponent(this) instead.
	proto.destroy = function(){
		this.removeListeners(this.listeners);
	};
	
	/*********************************************************************************************************
	 * The stuff below here will stay the same for all components. It's BORING!
	 *********************************************************************************************************/

	proto.addListeners = function(messageIds){
		for(var message in messageIds) this.addListener(messageIds[message]);
	};

	proto.removeListeners = function(listeners){
		for(var messageId in listeners) this.removeListener(messageId, listeners[messageId]);
	};
	
	proto.addListener = function(messageId, callback){
		var self = this,
		func = callback || function(value, debug){
			self[messageId](value, debug);
		};
		this.owner.bind(messageId, func);
		this.listeners[messageId] = func;
	};

	proto.removeListener = function(boundMessageId, callback){
		this.owner.unbind(boundMessageId, callback);
	};
	
	return component;
})();


/*--------------------------------------------------
 *   dom-element - ../src/js/standard-components/dom-element.js
 */
/**
# COMPONENT **dom-element**
This component creates a DOM element associated with the entity. In addition to allowing for CSS styling, the element can also perform as a controller accepting click and touch inputs and triggering associated messages on the entity.

## Dependencies:
- [[Handler-Render-Dom]] (on entity's parent) - This component listens for a render "handle-render-load" message with a DOM element to setup and display the element.

## Messages

### Listens for:
- **handle-render-load** - This event provides the parent DOM element that this component will require for displaying its DOM element.
  > @param message.element (DOM element) - Required. Provides the render component with the necessary DOM element parent.
- **handle-render** - On each `handle-render` message, this component checks to see if there has been a change in the state of the entity. If so (and updateClassName is set to true in the JSON definition) it updates its className accordingly.
- **logical-state** - This component listens for logical state changes and updates its local record of states.
  > @param message (object) - Required. Lists various states of the entity as boolean values. For example: {jumping: false, walking: true}. This component retains its own list of states and updates them as `logical-state` messages are received, allowing multiple logical components to broadcast state messages.
- **update-content** - This message updates the innerHTML of the DOM element.
  > @param message.text (string) - Required. The text that should replace the DOM element's innerHTML.

### Local Broadcasts:
- **[Messages specified in definition]** - Element event handlers will trigger messages as defined in the JSON definition.
  > @param message (DOM Event object) - When messages are triggered on the entity, the associated message object is the DOM Event object that was provided to the originating DOM Event handler.

## JSON Definition
    {
      "type": "dom-element",

      "element": "div",
      //Required. Sets what type of DOM element should be created.
      
      "innerHTML": "Hi!",
      //Optional. Sets the DOM element's inner text or HTML.
      
      "className": "top-band",
      //Optional. Any standard properties of the element can be set by listing property names and their values. "className" is one example, but other element properties can be specified in the same way.
      
      "updateClassName": true,
      //Optional. Specifies whether the className of the DOM element should be updated to reflect the entity's logical state. This setting will cause the className to equal its setting above followed by a space-delimited list of its `true` valued state names.
      
      "onmousedown": "turn-green",
      //Optional. If specified properties begin with "on", it is assumed that the property is an event handler and the listed value is broadcast as a message on the entity where the message object is the event handler's event object.

      "onmouseup": ["turn-red", "shout"]
      //Optional. In addition to the event syntax above, an Array of strings may be provided, causing multiple messages to be triggered in the order listed.
    }
*/
platformer.components['dom-element'] = (function(){
	var createFunction = function(message, entity){
		if(typeof message === 'string'){
			return function(e){
				entity.trigger(message, e);
				e.preventDefault();
			};
		} else {
			return function(e){
				for (var i = 0; i < message.length; i++){
					entity.trigger(message[i], e);
				}
				e.preventDefault();
			};
		}
	},
	component = function(owner, definition){
		var elementType = definition.element   || 'div';
		
		this.owner = owner;
		this.updateClassName = definition.updateClassName || false;
		this.className = '';
		this.states = {};
		this.stateChange = false;
		
		// Messages that this component listens for
		this.listeners = [];
		this.addListeners(['handle-render-load', 'handle-render', 'update-content', 'logical-state']);
		
		this.element = this.owner.element = document.createElement(elementType);
		this.element.ondragstart = function() {return false;}; //prevent element dragging by default

		for(var i in definition){
			if(i === 'style'){
				for(var j in definition[i]){
					this.element.style[j] = definition[i][j]; 
				}
			} else if((i !== 'type') && (i !== 'element') && (i !== 'updateClassName')){
				if(i.indexOf('on') === 0){
					this.element[i] = createFunction(definition[i], this.owner);
				} else {
					this.element[i] = definition[i];
					if(i == 'className'){
						this.className = definition[i];
					}
				}
			}
		}
		
		if(this.owner.className){
			this.className = this.element.className = this.owner.className;
		}
		if(this.owner.innerHTML){
			this.element.innerHTML = this.owner.innerHTML;
		}
	};
	var proto = component.prototype;
	
	proto['handle-render-load'] = function(resp){
		if(resp.element){
			this.parentElement = resp.element;
			this.parentElement.appendChild(this.element);
		}
	};
	
	proto['handle-render'] = function(resp){
		var i     = 0,
		className = this.className;
		
		if(this.stateChange && this.updateClassName){
			for(i in this.states){
				if(this.states[i]){
					className += ' ' + i;
				}
			}
			this.element.className = className;
			this.stateChange = false;
		}
	};
	
	proto['update-content'] = function(resp){
		if(resp && resp.text && (resp.text !== this.element.innerHTML)){
			this.element.innerHTML = resp.text;
		}
	};
	
	proto['logical-state'] = function(state){
		for(var i in state){
			if(this.states[i] !== state[i]){
				this.stateChange = true;
				this.states[i] = state[i];
			}
		}
	};
	
	// This function should never be called by the component itself. Call this.owner.removeComponent(this) instead.
	proto.destroy = function(){
		this.removeListeners(this.listeners);
		if(this.parentElement){
			this.parentElement.removeChild(this.element);
			this.parentElement = undefined;
		}
		if(this.owner.element === this.element){
			this.owner.element = undefined;
		}
		this.element = undefined;
	};
	
	/*********************************************************************************************************
	 * The stuff below here will stay the same for all components. It's BORING!
	 *********************************************************************************************************/

	proto.addListeners = function(messageIds){
		for(var message in messageIds) this.addListener(messageIds[message]);
	};

	proto.removeListeners = function(listeners){
		for(var messageId in listeners) this.removeListener(messageId, listeners[messageId]);
	};
	
	proto.addListener = function(messageId, callback){
		var self = this,
		func = callback || function(value, debug){
			self[messageId](value, debug);
		};
		this.owner.bind(messageId, func);
		this.listeners[messageId] = func;
	};

	proto.removeListener = function(boundMessageId, callback){
		this.owner.unbind(boundMessageId, callback);
	};
	
	return component;
})();


/*--------------------------------------------------
 *   entity-container - ../src/js/standard-components/entity-container.js
 */
/**
# COMPONENT **entity-container**
This component allows the entity to contain child entities. It will add several methods to the entity to manage adding and removing entities.

## Messages

### Listens for:
- **load** - This component waits until all other entity components are loaded before it begins adding children entities. This allows other entity components to listen to entity-added messages and handle them if necessary.
- **add-entity** - This message will added the given entity to this component's list of entities.
  > @param message ([[Entity]] object) - Required. This is the entity to be added as a child.
- **remove-entity** - On receiving this message, the provided entity will be removed from the list of child entities.
  > @param message ([[Entity]] object) - Required. The entity to remove.
- **[Messages specified in definition]** - Listens for specified messages and on receiving them, re-triggers them on child entities.
  > @param message (object) - accepts a message object that it will include in the new message to be triggered.

### Local Broadcasts:
- **child-entity-added** - This message is triggered when a new entity has been added to the list of children entities.
  > @param message ([[Entity]] object) - The entity that was just added.
- **child-entity-removed** - This message is triggered when an entity has been removed from the list of children entities.
  > @param message ([[Entity]] object) - The entity that was just removed.

### Child Broadcasts:
- **peer-entity-added** - This message is triggered when a new entity has been added to the parent's list of children entities.
  > @param message ([[Entity]] object) - The entity that was just added.
- **peer-entity-removed** - This message is triggered when an entity has been removed from the parent's list of children entities.
  > @param message ([[Entity]] object) - The entity that was just removed.
- **[Messages specified in definition]** - Listens for specified messages and on receiving them, re-triggers them on child entities.
  > @param message (object) - sends the message object received by the original message.

## Methods:
- **AddEntity** -  This method will add the provided entity to this component's list of entities.
  > @param entity ([[Entity]] object) - Required. This is the entity to be added as a child.
  > @return entity ([[Entity]] object) - Returns the entity that was just added.
- **removeEntity** - This method will remove the provided entity from the list of child entities.
  > @param message ([[Entity]] object) - Required. The entity to remove.
  > @return entity ([[Entity]] object | false) - Returns the entity that was just removed. If the entity was not foudn as a child, `false` is returned, indicated that the provided entity was not a child of this entity.

## JSON Definition:
    {
      "type": "entity-container",
      
      "entities": [{"type": "hero"}, {"type": "tile"}],
      // Optional. "entities" is an Array listing entity definitions to specify entities that should be added as children when this component loads.
      
      "childEvents": ["tokens-flying", "rules-updated"]
      // Optional. "childEvents" lists messages that are triggered on the entity and should be triggered on the children as well.
    }
*/
platformer.components['entity-container'] = (function(){
	var childBroadcast = function(event){
		if(typeof event === 'string'){
			return function(value, debug){
				for (var x = 0; x < this.entities.length; x++)
				{
					this.entities[x].trigger(event, value, debug);
				}
			};
		} else {
			return function(value, debug){
				for (var e in event){
					for (var x = 0; x < this.entities.length; x++)
					{
						this.entities[x].trigger(event[e], value, debug);
					}
				}
			};
		}
	},
	component = function(owner, definition){
		var self = this;

		this.owner = owner;
		
		// Messages that this component listens for
		this.listeners = [];
		this.addListeners(['load', 'add-entity', 'remove-entity']);

		this.entities = [];
		this.definedEntities = definition.entities; //saving for load message
		
		this.owner.entities     = self.entities;
		this.owner.addEntity    = function(entity){return self.addEntity(entity);};
		this.owner.removeEntity = function(entity){return self.removeEntity(entity);};
		
		if(definition.childEvents){
			for(var event in definition.childEvents){
				this[definition.childEvents[event]] = childBroadcast(definition.childEvents[event]);
				this.addListener(definition.childEvents[event]);
			}
		}
	},
	proto = component.prototype;
	
	proto['load'] = function(){
		// putting this here so all other components will have been loaded and can listen for "entity-added" calls.
		var x    = 0,
		entities = this.definedEntities;
		
		this.definedEntities = false;
		
		if(entities){
			for (x = 0; x < entities.length; x++)
			{
				 this.addEntity(new platformer.classes.entity(platformer.settings.entities[entities[x].type], entities[x]));
			}
		}
	};
	
	proto.addEntity = proto['add-entity'] = function (entity) {   
		for (var x = 0; x < this.entities.length; x++)
		{
			entity.trigger('peer-entity-added', this.entities[x]);
		}
		
		for (var x = 0; x < this.entities.length; x++)
		{
			this.entities[x].trigger('peer-entity-added', entity);
		}
		this.entities.push(entity);
		this.owner.trigger('child-entity-added', entity);
		entity.parent = this.owner;
		return entity;
	};
	
	proto.removeEntity = proto['remove-entity'] = function (entity) {
		for (var x = 0; x < this.entities.length; x++){
		    if(this.entities[x] === entity){
				for (var y = 0; y < this.entities.length; y++){
					if(x !== y){
						this.entities[y].trigger('peer-entity-removed', entity);
					}
				}
		    	entity.parent = undefined;
		    	this.entities.splice(x, 1);
				this.owner.trigger('child-entity-removed', entity);
		    	entity.destroy();
			    return entity;
		    }
	    }
	    return false;
	};
	
	// This function should never be called by the component itself. Call this.owner.removeComponent(this) instead.
	proto.destroy = function(){
		this.removeListeners(this.listeners);
		for (var i in this.entities){
			this.entities[i].destroy();
		}
		this.entities.length = 0;
	};
	
	/*********************************************************************************************************
	 * The stuff below here will stay the same for all components. It's BORING!
	 *********************************************************************************************************/

	proto.addListeners = function(messageIds){
		for(var message in messageIds) this.addListener(messageIds[message]);
	};

	proto.removeListeners = function(listeners){
		for(var messageId in listeners) this.removeListener(messageId, listeners[messageId]);
	};
	
	proto.addListener = function(messageId, callback){
		var self = this,
		func = callback || function(value, debug){
			self[messageId](value, debug);
		};
		this.owner.bind(messageId, func);
		this.listeners[messageId] = func;
	};

	proto.removeListener = function(boundMessageId, callback){
		this.owner.unbind(boundMessageId, callback);
	};
	
	return component;
})();


/*--------------------------------------------------
 *   entity-controller - ../src/js/standard-components/entity-controller.js
 */
/**
# COMPONENT **entity-controller**
This component listens for input messages triggered on the entity and updates the state of any controller inputs it is listening for. It then broadcasts messages on the entity corresponding to the input it received.

## Dependencies:
- [[Handler-Controller]] (on entity's parent) - This component listens for a controller "tick" message in order to trigger messages regarding the state of its inputs.

## Messages

### Listens for:
- **handle-controller** - On each `handle-controller` message, this component checks its list of actions and if any of their states are currently true or were true on the last call, that action message is triggered.
- **mousedown** - This message is re-triggered on the entity as a new message including the button that was pressed: "mouse:left-button:down", "mouse:middle-button:down", or "mouse:right-button:down".
  > @param message.event (DOM Event object) - This event object is passed along with the new message.
- **mouseup** - This message is re-triggered on the entity as a new message including the button that was released: "mouse:left-button:up", "mouse:middle-button:up", or "mouse:right-button:up".
  > @param message.event (DOM Event object) - This event object is passed along with the new message.
- **mousemove** - Updates mouse action states with whether the mouse is currently over the entity.
  > @param message.over (boolean) - Whether the mouse is over the input entity.
- **[Messages specified in definition]** - Listens for additional messages and on receiving them, sets the appropriate state and broadcasts the associated message on the next `handle-controller` message. These messages come in pairs and typically have the form of "keyname:up" and "keyname:down" specifying the current state of the input.
  
### Local Broadcasts:
- **mouse:mouse-left:down, mouse:mouse-left:up, mouse:mouse-middle:down, mouse:mouse-middle:up, mouse:mouse-right:down, mouse:mouse-right:up** - This component triggers the state of mouse inputs on the entity if a render component of the entity accepts mouse input (for example [[Render-Animation]]).
  > @param message (DOM Event object) - The original mouse event object is passed along with the control message.
- **[Messages specified in definition]** - Broadcasts active states using the JSON-defined message on each `handle-controller` message. Active states include `pressed` being true or `released` being true. If both of these states are false, the message is not broadcasted.
  > @param message.pressed (boolean) - Whether the current input is active.
  > @param message.released (boolean) - Whether the current input was active last tick but is no longer active.
  > @param message.triggered (boolean) - Whether the current input is active but was not active last tick.
  > @param message.over (boolean) - Whether the mouse was over the entity when pressed, released, or triggered. This value is always false for non-mouse input messages.

## JSON Definition:
    {
      "type": "entity-controller",
      
      "controlMap":{
      // Required. Use the controlMap property object to map inputs to messages that should be triggered. At least one control mapping should be included. The following are a few examples:
      
        "key:x": "run-left",
        // This causes an "x" keypress to fire "run-left" on the entity. For a full listing of key names, check out the `handler-controller` component.
        
        "button-pressed": "throw-block",
        // custom input messages can be fired on this entity from other entities, allowing for on-screen input buttons to run through the same controller channel as other inputs.
        
        "mouse:left-button"
        // The controller can also handle mouse events on the entity if the entity's render component triggers mouse events on the entity (for example, the `render-animation` component).
      }
    }
*/
platformer.components['entity-controller'] = (function(){
	var state = function(){
		this.current = false;
		this.last    = false;
		this.state   = false;
		this.stateSummary = {
			pressed:   false,
			released:  false,
			triggered: false,
			over:      false
		};
	},
	mouseMap = ['left-button', 'middle-button', 'right-button'],
	createUpHandler = function(state){
		return function(value){
			state.state = false;
		};
	},
	createDownHandler = function(state){
		return function(value){
			state.current = true;
			state.state   = true;
			if(value && (typeof (value.over) !== 'undefined')) state.over = value.over;
		};
	},
	component = function(owner, definition){
		var key     = '',
		actionState = undefined;
		this.owner  = owner;
		
		// Messages that this component listens for
		this.listeners = [];
		this.addListeners(['handle-controller', 'mousedown', 'mouseup', 'mousemove']);
		
		if(definition && definition.controlMap){
			this.owner.controlMap = definition.controlMap; // this is used and expected by the handler-controller to handle messages not covered by key and mouse inputs.
			this.actions  = {};
			for(key in definition.controlMap){
				actionState = this.actions[definition.controlMap[key]]; // If there's already a state storage object for this action, reuse it: there are multiple keys mapped to the same action.
				if(!actionState){                                // Otherwise create a new state storage object
					actionState = this.actions[definition.controlMap[key]] = new state();
				}
				this[key + ':up']   = createUpHandler(actionState);
				this[key + ':down'] = createDownHandler(actionState);
				this.addListener(key + ':up');
				this.addListener(key + ':down');
			}
		}
	},
	stateProto = state.prototype,
	proto      = component.prototype;
	
	stateProto.update = function(){
		this.last    = this.current;
		this.current = this.state;
	};

	stateProto.isPressed = function(){
		return this.current;
	};
	
	stateProto.isTriggered = function(){
		return this.current && !this.last;
	};

	stateProto.isReleased = function(){
		return !this.current && this.last;
	};
	
	stateProto.getState = function(){
		this.stateSummary.pressed   = this.current;
		this.stateSummary.released  = !this.current && this.last;
		this.stateSummary.triggered = this.current && !this.last;
		this.stateSummary.over      = this.over;
		return this.stateSummary;
	};
	
	proto['handle-controller'] = function(){
		var state = undefined,
		action    = '';
		
		if(this.actions){
			for (action in this.actions){
				state = this.actions[action];
				if(state.current || state.last){
					this.owner.trigger(action, state.getState());
				}
				state.update();
			}
		}
	};
	
	// The following translate CreateJS mouse and touch events into messages that this controller can handle in a systematic way
	
	proto['mousedown'] = function(value){
		this.owner.trigger('mouse:' + mouseMap[value.event.button || 0] + ':down', value.event);
	}; 
		
	proto['mouseup'] = function(value){
		this.owner.trigger('mouse:' + mouseMap[value.event.button || 0] + ':up', value.event);
	};
	
	proto['mousemove'] = function(value){
		if(this.actions['mouse:left-button'] && (this.actions['mouse:left-button'].over !== value.over))     this.actions['mouse:left-button'].over = value.over;
		if(this.actions['mouse:middle-button'] && (this.actions['mouse:middle-button'].over !== value.over)) this.actions['mouse:middle-button'].over = value.over;
		if(this.actions['mouse:right-button'] && (this.actions['mouse:right-button'].over !== value.over))   this.actions['mouse:right-button'].over = value.over;
	};
/*
	proto['mouseover'] = function(value){
		this.owner.trigger('mouse:' + mouseMap[value.event.button] + ':over', value.event);
	};

	proto['mouseout'] = function(value){
		this.owner.trigger('mouse:' + mouseMap[value.event.button] + ':out', value.event);
	};
*/
	
	
	// This function should never be called by the component itself. Call this.owner.removeComponent(this) instead.
	proto.destroy = function(){
		this.removeListeners(this.listeners);
	};
	
	/*********************************************************************************************************
	 * The stuff below here will stay the same for all components. It's BORING!
	 *********************************************************************************************************/

	proto.addListeners = function(messageIds){
		for(var message in messageIds) this.addListener(messageIds[message]);
	};

	proto.removeListeners = function(listeners){
		for(var messageId in listeners) this.removeListener(messageId, listeners[messageId]);
	};
	
	proto.addListener = function(messageId, callback){
		var self = this,
		func = callback || function(value, debug){
			self[messageId](value, debug);
		};
		this.owner.bind(messageId, func);
		this.listeners[messageId] = func;
	};

	proto.removeListener = function(boundMessageId, callback){
		this.owner.unbind(boundMessageId, callback);
	};
	
	return component;
})();


/*--------------------------------------------------
 *   render-debug - ../src/js/standard-components/render-debug.js
 */
/**
# COMPONENT **render-debug**
This component is attached to entities that will appear in the game world. It serves two purposes. First, it displays a rectangle that indicates location of the object. By default it uses the specified position and dimensions of the object (in green), if the object has a collision component it will display the AABB of the collision shape (in pink). The render-debug component also allows the user to click on an object and it will print the object in the debug console. 

## Dependencies
- [[Handler-Render]] (on entity's parent) - This component listens for a render "handle-render" and "handle-render-load" message to setup and display the content.

## Messages

### Listens for:
- **handle-render** - Repositions the pieces of the component in preparation for rendering
- **handle-render-load** - The visual components are set up and added to the stage. Setting up mouse input stuff. The click-to-print-to-console functionality is set up too. 
  > @param resp.stage ([createjs.Stage][link1]) - This is the stage on which the component will be displayed.

### Local Broadcasts:
- **mousedown** - Render-debug captures this message and uses it and then passes it on to the rest of the object in case it needs to do something else with it.
  > @param event (event object) - The event from Javascript.
  > @param over (boolean) - Whether the mouse is over the object or not.
  > @param x (number) - The x-location of the mouse in stage coordinates.
  > @param y (number) - The y-location of the mouse in stage coordinates.
  > @param entity ([[Entity]]) - The entity clicked on.  
- **mouseup** - Render-debug captures this message and uses it and then passes it on to the rest of the object in case it needs to do something else with it.
  > @param event (event object) - The event from Javascript.
  > @param over (boolean) - Whether the mouse is over the object or not.
  > @param x (number) - The x-location of the mouse in stage coordinates.
  > @param y (number) - The y-location of the mouse in stage coordinates.
  > @param entity ([[Entity]]) - The entity clicked on.  
- **mousemove** - Render-debug captures this message and uses it and then passes it on to the rest of the object in case it needs to do something else with it.
  > @param event (event object) - The event from Javascript.
  > @param over (boolean) - Whether the mouse is over the object or not.
  > @param x (number) - The x-location of the mouse in stage coordinates.
  > @param y (number) - The y-location of the mouse in stage coordinates.
  > @param entity ([[Entity]]) - The entity clicked on.  

## JSON Definition
    {
      "type": "render-debug",
      "acceptInput": {
      	//Optional - What types of input the object should take.
      	"hover": false;
      	"click": false; 
      }, 
      "regX": 0,
      //Optional - The X offset from X position for the displayed shape. If you're using the AABB this is set automatically.
      "regY": 0
      //Optional - The Y offset from Y position for the displayed shape. If you're using the AABB this is set automatically.
    }
    
[link1]: http://createjs.com/Docs/EaselJS/Stage.html
*/


platformer.components['render-debug'] = (function(){
	var component = function(owner, definition){
		this.owner = owner;
		
		//this.controllerEvents = undefined;
		
		if(definition.acceptInput){
			this.hover = definition.acceptInput.hover || false;
			this.click = definition.acceptInput.click || false;
		} else {
			this.hover = false;
			this.click = false;
		}
		
		this.regX = definition.regX || 0;
		this.regY = definition.regY || 0;
		this.stage = undefined;
		//this.txt = undefined;
		this.shape = undefined;
		
		// Messages that this component listens for
		this.listeners = [];
		this.addListeners(['handle-render', 'handle-render-load']);
	};
	var proto = component.prototype;

	proto['handle-render-load'] = function(resp){
		var self = this,
		x        = this.owner.x      = this.owner.x || 0,
		y        = this.owner.y      = this.owner.y || 0,
		z        = this.owner.z      = this.owner.z || 0,
		width    = this.owner.width  = this.owner.width  || 300,
		height   = this.owner.height = this.owner.height || 100,
		comps    = platformer.settings.entities[this.owner.type]?(platformer.settings.entities[this.owner.type].components || []):[],
		components = [],
		over     = false;
		
		for (var i in comps) components[i] = comps[i].type;
		
		this.stage = resp.stage;
		
		/*
		this.txt   = new createjs.Text(this.owner.type + '\n(' + components.join(', ') + ')');
		this.txt.x = x + width / 2;
		this.txt.y = y + height / 2;
		this.txt.z = z;
		this.txt.textAlign = "center";
		this.txt.textBaseline = "middle";
		*/
		
		if(this.owner.getAABB){
			var aabb   = this.owner.getAABB();
			width      = this.initialWidth  = aabb.width;
			height     = this.initialHeight = aabb.height;
			this.shape = new createjs.Shape((new createjs.Graphics()).beginFill("rgba(255,0,255,0.1)").setStrokeStyle(3).beginStroke("#f0f").rect(0, 0, width, height));
			this.regX  = width  / 2;
			this.regY  = height / 2;
		} else {
			this.shape = new createjs.Shape((new createjs.Graphics()).beginFill("rgba(0,0,0,0.1)").beginStroke("#880").rect(0, 0, width, height));
		}
		this.shape.z = z + 10000;
		this.stage.addChild(this.shape);
		//this.stage.addChild(this.txt);
		
		// The following appends necessary information to displayed objects to allow them to receive touches and clicks
		if(this.click && createjs.Touch.isSupported()){
			createjs.Touch.enable(this.stage);
		}

		this.shape.onPress     = function(event) {
			if(this.click){
				self.owner.trigger('mousedown', {
					event: event.nativeEvent,
					over: over,
					x: event.stageX,
					y: event.stageY,
					entity: self.owner
				});
				event.onMouseUp = function(event){
					self.owner.trigger('mouseup', {
						event: event.nativeEvent,
						over: over,
						x: event.stageX,
						y: event.stageY,
						entity: self.owner
					});
				};
				event.onMouseMove = function(event){
					self.owner.trigger('mousemove', {
						event: event.nativeEvent,
						over: over,
						x: event.stageX,
						y: event.stageY,
						entity: self.owner
					});
				};
			}
			if(event.nativeEvent.button == 2){
				console.log('This Entity:', self.owner);
			}
		};
		if(this.click){
			this.shape.onMouseOut  = function(){over = false;};
			this.shape.onMouseOver = function(){over = true;};
		}
		if(this.hover){
			this.stage.enableMouseOver();
			this.shape.onMouseOut  = function(event){
				over = false;
				self.owner.trigger('mouseout', {
					event: event.nativeEvent,
					over: over,
					x: event.stageX,
					y: event.stageY,
					entity: self.owner
				});
			};
			this.shape.onMouseOver = function(event){
				over = true;
				self.owner.trigger('mouseover', {
					event: event.nativeEvent,
					over: over,
					x: event.stageX,
					y: event.stageY,
					entity: self.owner
				});
			};
		}
	};
	
	proto['handle-render'] = function(){
		if(this.owner.getAABB){
			var aabb   = this.owner.getAABB();
			this.shape.scaleX = aabb.width / this.initialWidth;
			this.shape.scaleY = aabb.height / this.initialHeight;
			this.shape.x = aabb.x - aabb.halfWidth;
			this.shape.y = aabb.y - aabb.halfHeight;
			this.shape.z = this.owner.z;
			this.shape.z += 10000;
			/*
			this.txt.x = aabb.x;
			this.txt.y = aabb.y;
			this.txt.z = this.owner.z;
			*/
		} else {
			this.shape.x = this.owner.x	- this.regX;
			this.shape.y = this.owner.y	- this.regY;
			this.shape.z = this.owner.z;
			this.shape.z += 10000;
			/*
			this.txt.x = this.owner.x	- this.regX + (this.owner.width / 2);
			this.txt.y = this.owner.y 	- this.regY + (this.owner.height / 2);
			this.txt.z = this.owner.z;
			*/
		}
		if(this.owner.getCollisionGroupAABB){
			var aabb = this.owner.getCollisionGroupAABB();
			if(!this.groupShape){
				this.groupShape = new createjs.Shape((new createjs.Graphics()).beginFill("rgba(0,255,0,0.1)").setStrokeStyle(3).beginStroke("#0f0").rect(0, 0, aabb.width, aabb.height));
				this.groupShapeInitialWidth  = aabb.width;
				this.groupShapeInitialHeight = aabb.height;
				this.stage.addChild(this.groupShape);
			}
			this.groupShape.scaleX = aabb.width  / this.groupShapeInitialWidth;
			this.groupShape.scaleY = aabb.height / this.groupShapeInitialHeight;
			this.groupShape.x      = aabb.x      - aabb.halfWidth;
			this.groupShape.y      = aabb.y      - aabb.halfHeight;
		}
	};
	
	// This function should never be called by the component itself. Call this.owner.removeComponent(this) instead.
	proto.destroy = function(){
		this.stage.removeChild(this.shape);
		//this.stage.removeChild(this.txt);
		this.shape = undefined;
		//this.txt = undefined;
		this.stage = undefined;
		this.removeListeners(this.listeners);
	};
	
	/*********************************************************************************************************
	 * The stuff below here will stay the same for all components. It's BORING!
	 *********************************************************************************************************/
	
	proto.addListeners = function(messageIds){
		for(var message in messageIds) this.addListener(messageIds[message]);
	};

	proto.removeListeners = function(listeners){
		for(var messageId in listeners) this.removeListener(messageId, listeners[messageId]);
	};
	
	proto.addListener = function(messageId, callback){
		var self = this,
		func = callback || function(value, debug){
			self[messageId](value, debug);
		};
		this.owner.bind(messageId, func);
		this.listeners[messageId] = func;
	};

	proto.removeListener = function(boundMessageId, callback){
		this.owner.unbind(boundMessageId, callback);
	};
	
	return component;
})();


/*--------------------------------------------------
 *   render-tiles - ../src/js/standard-components/render-tiles.js
 */
/**
# COMPONENT **render-tiles**
This component handles rendering tile map backgrounds. To do so, it first compiles a giant 2D array of all the tiles in the map in the tiles array. Then when it comes time to render it figures out which tiles from the tiles array are actually within the range it needs to draw and puts them in the tilesToRender array. This it caches in case the camera doesn't move and there's no need to change the image next frame.

## Dependencies:
- [createjs.EaselJS][link1] - This component requires the EaselJS library to be included for canvas functionality.
- [[Handler-Render-Createjs]] (on entity's parent) - This component listens for a render "handle-render-load" message to setup and display the content. This component is removed from the Handler-Render-Createjs list after the first tick because it doesn't possess a handle-render function. Instead it uses the camera-update function to update itself.

## Messages

### Listens for:
- **handle-render-load** - This event is triggered before `handle-render` and provides the CreateJS stage that this component will require for displaying animations. In this case it compiles the array of tiles that make up the map and adds the tilesToRender displayObject to the stage.
  > @param message.stage ([createjs.Stage][link2]) - Required. Provides the render component with the CreateJS drawing [Stage][link2].
- **camera-update** - Triggered when the camera moves, this function updates which tiles need to be rendered and caches the image.
  > @param camera (object) - Required. Provides information about the camera.

## JSON Definition
    {
      "type": "render-animation",
      "spritesheet": 
      //Required - The spritesheet for all the tile images.
      "imageMap" : [],
      //Required - This is a two dimensional array of the spritesheet indexes that describe the map that you're rendering.
	  "scaleX" : 1,
	  //Optional - The x-scale the tilemap is being displayed at. Defaults to 1.
	  "scaleY"  : 1,
	  //Optional - The y-scale the tilemap is being displayed at. Defaults to 1.
	  "tileWidth"  : 32,
	  //Optional - The the width in pixels of a tile. Defaults to 10.
	  "tileHeight"  : 32,
	  //Optional - The the height in pixels of a tile. Defaults to 10.
	  "buffer"  : 32
	  //Optional - The amount of space in pixels around the edge of the camera that we include in the buffered image. Is multiplied by the scaleX to get the actual buffersize. Defaults to the tileWidth.
    }
    
[link1]: http://www.createjs.com/Docs/EaselJS/module_EaselJS.html
[link2]: http://createjs.com/Docs/EaselJS/Stage.html
*/

platformer.components['render-tiles'] = (function(){
	var component = function(owner, definition){
		var spriteSheet = {
			images: definition.spriteSheet.images.slice(),
			frames: definition.spriteSheet.frames,
			animations: definition.spriteSheet.animations
		},
		scaleX = spriteSheet.images[0].scaleX || 1,
		scaleY = spriteSheet.images[0].scaleY || 1;
		if((scaleX !== 1) || (scaleY !== 1)){
			spriteSheet.frames = {
				width: spriteSheet.frames.width * scaleX,	
				height: spriteSheet.frames.height * scaleY,	
				regX: spriteSheet.frames.regX * scaleX,	
				regY: spriteSheet.frames.regY * scaleY
			};
		}

		this.owner = owner;
		
		this.controllerEvents = undefined;
		this.spriteSheet   = new createjs.SpriteSheet(spriteSheet);
		this.imageMap      = definition.imageMap   || [];
		this.tiles         = {};
		this.tilesToRender = undefined;
		this.scaleX        = ((definition.scaleX || 1) * (this.owner.scaleX || 1)) / scaleX;
		this.scaleY        = ((definition.scaleY || 1) * (this.owner.scaleY || 1)) / scaleY;
		this.tileWidth     = definition.tileWidth  || (this.owner.tileWidth / this.scaleX)  || 10;
		this.tileHeight    = definition.tileHeight || (this.owner.tileHeight / this.scaleY) || 10;
		
		var buffer = (definition.buffer || (this.tileWidth / 2)) * this.scaleX;
		this.camera = {
			x: -buffer - 1, //to force camera update
			y: -buffer - 1,
			buffer: buffer
		};
		this.cache = {
			minX: -1,
			minY: -1,
			maxX: -1,
			maxY: -1
		};
		
		//this.state = definition.state || 'tile';
		
		// Messages that this component listens for
		this.listeners = [];
		this.addListeners(['handle-render-load', 'camera-update', 'add-tiles']);
	};
	var proto = component.prototype;

	proto['handle-render-load'] = function(resp){
		var x = 0,
		y     = 0,
		stage = this.stage = resp.stage,
		index = '',
		imgMapDefinition = this.imageMap,
		newImgMap = [];
		
		this.tilesToRender = new createjs.Container();
		this.tilesToRender.snapToPixel = true;
		this.tilesToRender.name = 'entity-managed'; //its visibility is self-managed
		
		for(x = 0; x < imgMapDefinition.length; x++){
			newImgMap[x] = [];
			for (y = 0; y < imgMapDefinition[x].length; y++){
				newImgMap[x][y] = index = imgMapDefinition[x][y];
				if(!this.tiles[index]){
					this.tiles[index] = this.createTile(index);
				}
			}
		}
		this.imageMap = newImgMap;
		
		this.tilesToRender.scaleX = this.scaleX;
		this.tilesToRender.scaleY = this.scaleY;
		this.tilesToRender.z = this.owner.z;

		stage.addChild(this.tilesToRender);
		stage.autoClear = false; //since tile map is re-painted every time, the canvas does not require clearing.
	};
	
	proto['add-tiles'] = function(definition){
		var x = 0,
		y     = 0,
		map   = definition.imageMap,
		index = '',
		newIndex = 0;
		
		if(map){
			for(x = 0; x < this.imageMap.length; x++){
				for (y = 0; y < this.imageMap[x].length; y++){
					newIndex = map[x][y];
					index = this.imageMap[x][y];
					if(this.tiles[index]){
						delete this.tiles[index];
					}
					index = this.imageMap[x][y] += ' ' + newIndex;
					if(!this.tiles[index]){
						this.tiles[index] = this.createTile(index);
					}
				}
			}
		}
	};

	proto['camera-update'] = function(camera){
		var x  = 0,
		y      = 0,
		buffer = this.camera.buffer,
		cache  = this.cache,
		context= null,
		canvas = null,
		width  = 0,
		height = 0,
		maxX   = 0,
		maxY   = 0,
		minX   = 0,
		minY   = 0,
		vpL    = Math.floor(camera.viewportLeft / this.tileWidth)  * this.tileWidth,
		vpT    = Math.floor(camera.viewportTop  / this.tileHeight) * this.tileHeight,
		tile   = null;
				
		if (((Math.abs(this.camera.x - vpL) > buffer) || (Math.abs(this.camera.y - vpT) > buffer)) && (this.imageMap.length > 0)){
			this.camera.x = vpL;
			this.camera.y = vpT;
			
			//only attempt to draw children that are relevant
			maxX = Math.min(Math.ceil((vpL + camera.viewportWidth + buffer) / (this.tileWidth * this.scaleX)), this.imageMap.length) - 1;
			minX = Math.max(Math.floor((vpL - buffer) / (this.tileWidth * this.scaleX)), 0);
			maxY = Math.min(Math.ceil((vpT + camera.viewportHeight + buffer) / (this.tileHeight * this.scaleY)), this.imageMap[0].length) - 1;
			minY = Math.max(Math.floor((vpT - buffer) / (this.tileHeight * this.scaleY)), 0);

			if((maxY > cache.maxY) || (minY < cache.minY) || (maxX > cache.maxX) || (minX < cache.minX)){
				if(this.tilesToRender.cacheCanvas){
					canvas = this.tilesToRender.cacheCanvas;
					this.tilesToRender.uncache();
				}
				
				this.tilesToRender.removeChildAt(0);
				this.tilesToRender.cache(minX * this.tileWidth, minY * this.tileHeight, (maxX - minX + 1) * this.tileWidth, (maxY - minY + 1) * this.tileHeight);
				
				for(x = minX; x <= maxX; x++){
					for (y = minY; y <= maxY; y++){
						if((y > cache.maxY) || (y < cache.minY) || (x > cache.maxX) || (x < cache.minX)){
							tile = this.tiles[this.imageMap[x][y]];
							this.tilesToRender.removeChildAt(0); // Leaves one child in the display object so createjs will render the cached image.
							this.tilesToRender.addChild(tile);
							tile.x = x * this.tileWidth;
							tile.y = y * this.tileHeight;
							this.tilesToRender.updateCache('source-over');
						}
					}
				}

				if(canvas){
					context = this.tilesToRender.cacheCanvas.getContext('2d');
					width   = (cache.maxX - cache.minX + 1) * this.tileWidth;
					height  = (cache.maxY - cache.minY + 1) * this.tileHeight;
					context.drawImage(canvas, 0, 0, width, height, (cache.minX - minX) * this.tileWidth, (cache.minY - minY) * this.tileHeight, width, height);
					cache.minX = minX;
					cache.minY = minY;
					cache.maxX = maxX;
					cache.maxY = maxY;
				}
			}
		}
	};
	
	proto.createTile = function(imageName){
		var i = 1,
		imageArray = imageName.split(' ');
		tile  = new createjs.BitmapAnimation(this.spriteSheet);
		
		tile.x = 0;
		tile.y = 0;
		tile.gotoAndPlay(imageArray[0]);
		tile.cache(0,0,this.tileWidth,this.tileHeight);
		
		for (; i < imageArray.length; i++){
			tile.gotoAndPlay(imageArray[i]);
			tile.updateCache('source-over');
		}

		return tile;
	};
	
	// This function should never be called by the component itself. Call this.owner.removeComponent(this) instead.
	proto.destroy = function(){
		this.removeListeners(this.listeners);
		this.tilesToRender.removeAllChildren();
		this.stage.removeChild(this.tilesToRender);
		this.imageMap.length = 0;
		this.tiles = undefined;
		this.camera = undefined;
		this.stage = undefined;
		this.tilesToRender = undefined;
		this.owner = undefined;
	};
	
	/*********************************************************************************************************
	 * The stuff below here will stay the same for all components. It's BORING!
	 *********************************************************************************************************/
	
	proto.addListeners = function(messageIds){
		for(var message in messageIds) this.addListener(messageIds[message]);
	};

	proto.removeListeners = function(listeners){
		for(var messageId in listeners) this.removeListener(messageId, listeners[messageId]);
	};
	
	proto.addListener = function(messageId, callback){
		var self = this,
		func = callback || function(value, debug){
			self[messageId](value, debug);
		};
		this.owner.bind(messageId, func);
		this.listeners[messageId] = func;
	};

	proto.removeListener = function(boundMessageId, callback){
		this.owner.unbind(boundMessageId, callback);
	};
	
	return component;
})();


/*--------------------------------------------------
 *   render-animation - ../src/js/standard-components/render-animation.js
 */
/**
# COMPONENT **render-animation**
This component is attached to entities that will appear in the game world. It renders an animated image. It listens for messages triggered on the entity or changes in the logical state of the entity to play a corresponding animation.

## Dependencies:
- [createjs.EaselJS][link1] - This component requires the EaselJS library to be included for canvas animation functionality.
- [[Handler-Render-Createjs]] (on entity's parent) - This component listens for a render "handle-render" and "handle-render-load" message to setup and display the content.

## Messages

### Listens for:
- **handle-render-load** - This event is triggered before `handle-render` and provides the CreateJS stage that this component will require for displaying animations.
  > @param message.stage ([createjs.Stage][link2]) - Required. Provides the render component with the CreateJS drawing [Stage][link2].
- **handle-render** - On each `handle-render` message, this component checks to see if there has been a change in the state of the entity. If so, it updates its animation play-back accordingly.
- **logical-state** - This component listens for logical state changes and tests the current state of the entity against the animation map. If a match is found, the matching animation is played.
  > @param message (object) - Required. Lists various states of the entity as boolean values. For example: {jumping: false, walking: true}. This component retains its own list of states and updates them as `logical-state` messages are received, allowing multiple logical components to broadcast state messages.
- **[Messages specified in definition]** - Listens for additional messages and on receiving them, begins playing the corresponding animations.

### Local Broadcasts:
- **mousedown** - Render-debug captures this message and uses it and then passes it on to the rest of the object in case it needs to do something else with it.
  > @param event (event object) - The event from Javascript.
  > @param over (boolean) - Whether the mouse is over the object or not.
  > @param x (number) - The x-location of the mouse in stage coordinates.
  > @param y (number) - The y-location of the mouse in stage coordinates.
  > @param entity ([[Entity]]) - The entity clicked on.  
- **mouseup** - Render-debug captures this message and uses it and then passes it on to the rest of the object in case it needs to do something else with it.
  > @param event (event object) - The event from Javascript.
  > @param over (boolean) - Whether the mouse is over the object or not.
  > @param x (number) - The x-location of the mouse in stage coordinates.
  > @param y (number) - The y-location of the mouse in stage coordinates.
  > @param entity ([[Entity]]) - The entity clicked on.  
- **mousemove** - Render-debug captures this message and uses it and then passes it on to the rest of the object in case it needs to do something else with it.
  > @param event (event object) - The event from Javascript.
  > @param over (boolean) - Whether the mouse is over the object or not.
  > @param x (number) - The x-location of the mouse in stage coordinates.
  > @param y (number) - The y-location of the mouse in stage coordinates.
  > @param entity ([[Entity]]) - The entity clicked on.  

## JSON Definition
    {
      "type": "render-animation",

      "animationMap":{
      //Optional. If the animation sequence will change, this is required. This defines a mapping from either triggered messages or one or more states for which to choose a new animation to play. The list is processed from top to bottom, so the most important actions should be listed first (for example, a jumping animation might take precedence over an idle animation).
      
          "standing": "default-animation"
          // On receiving a "standing" message, or a "logical-state" where message.standing == true, the "default" animation will begin playing.
          
          "ground,moving": "walking",
          // comma separated values have a special meaning when evaluating "logical-state" messages. The above example will cause the "walking" animation to play ONLY if the entity's state includes both "moving" and "ground" equal to true.
          
          "default": "default-animation",
          // Optional. "default" is a special property that matches all states. If none of the above states are valid for the entity, it will use the default animation listed here.
      }  

      "spriteSheet": {
      //Required. Defines an EaselJS sprite sheet to use for rendering. See http://www.createjs.com/Docs/EaselJS/SpriteSheet.html for the full specification.

	      "images": ["example0", "example1"],
	      //Required: An array of ids of the images from the asset list in config.js.
	      
	      "frames": {
	      //Required: The dimensions of the frames on the image and how to offset them around the entity position. The image is automatically cut up into pieces based on the dimensions. 
	      	"width":  100,
			"height": 100,
			"regY":   100,
			"regX":   50
	      },
	      
	      "animations":{
	      //Required: The list of animation ids and the frames that make up that animation. The frequency determines how long each frame plays. There are other possible parameters. Additional parameters and formatting info can be found in createJS.
			"default-animation":[2],
			"walking": {"frames": [0, 1, 2], "frequency": 4}
		  }
      }
      
      "state": "default",
      //Optional: The starting animation. This defaults to "default".
      
      "acceptInput": {
      	//Optional - What types of input the object should take.
      	"hover": false;
      	"click": false; 
      }, 
      
      "scaleX": 1,
      //Optional - The X scaling factor for the image. Will default to 1.
      
      "scaleY": 1
      //Optional - The Y scaling factor for the image. Will default to 1.
    }
    
[link1]: http://www.createjs.com/Docs/EaselJS/module_EaselJS.html
[link2]: http://createjs.com/Docs/EaselJS/Stage.html
*/
platformer.components['render-animation'] = (function(){
	var changeState = function(state){
		return function(value){
			if(this.currentAnimation !== state){
				if(this.animationFinished || (this.lastState >= -1)){
					this.currentAnimation = state;
					this.lastState = -1;
					this.animationFinished = false;
					this.anim.gotoAndPlay(state);
				} else {
					this.waitingAnimation = state;
					this.waitingState = -1;
				}
			}
		};
	},
	createTest = function(testStates, animation){
		var states = testStates.replace(/ /g, '').split(',');
		if(testStates === 'default'){
			return function(state){
				return animation;
			};
		} else {
			return function(state){
				for(var i = 0; i < states.length; i++){
					if(!state[states[i]]){
						return false;
					}
				}
				return animation;
			};
		}
	},
	component = function(owner, definition){
		var spriteSheet = {
			images: definition.spriteSheet.images.slice(),
			frames: definition.spriteSheet.frames,
			animations: definition.spriteSheet.animations
		},
		self = this,
		x = 0,
		lastAnimation = '';
		this.owner = owner;
		
		if(definition.acceptInput){
			this.hover = definition.acceptInput.hover || false;
			this.click = definition.acceptInput.click || false;
			this.touch = definition.acceptInput.touch || false;
		} else {
			this.hover = false;
			this.click = false;
			this.touch = false;
		}
		
		// Messages that this component listens for
		this.listeners = [];

		this.addListeners(['handle-render-load', 'handle-render', 'logical-state']);

		if(definition.animationMap){
			this.checkStates = [];
			for(var i in definition.animationMap){
				this.addListener(i);
				this[i] = changeState(definition.animationMap[i]);
				this.checkStates.push(createTest(i, definition.animationMap[i]));
				lastAnimation = definition.animationMap[i];
			}
		}
		
		this.stage = undefined;
		for (x = 0; x < spriteSheet.images.length; x++){
			spriteSheet.images[x] = platformer.assets[spriteSheet.images[x]];
		}
		var scaleX = spriteSheet.images[0].scaleX || 1,
		scaleY     = spriteSheet.images[0].scaleY || 1;
		if((scaleX !== 1) || (scaleY !== 1)){
			spriteSheet.frames = {
				width: spriteSheet.frames.width * scaleX,	
				height: spriteSheet.frames.height * scaleY,	
				regX: spriteSheet.frames.regX * scaleX,	
				regY: spriteSheet.frames.regY * scaleY
			};
		}
		spriteSheet = new createjs.SpriteSheet(spriteSheet);
		this.anim = new createjs.BitmapAnimation(spriteSheet);
		this.anim.onAnimationEnd = function(animationInstance, lastAnimation){
			if(self.waitingAnimation){
				self.currentAnimation = self.waitingAnimation;
				self.waitingAnimation = false;
				self.lastState = self.waitingState;
				
				self.animationFinished = false;
				self.anim.gotoAndPlay(self.currentAnimation);
			} else {
				self.animationFinished = true;
			}
		};
		this.currentAnimation = this.owner.state || definition.state || lastAnimation || 'default';
		this.anim.scaleX = ((definition.scaleX || 1) * (this.owner.scaleX || 1)) / scaleX;
		this.anim.scaleY = ((definition.scaleY || 1) * (this.owner.scaleY || 1)) / scaleY;
		this.state = {};
		this.stateChange = false;
		this.waitingAnimation = false;
		this.waitingState = 0;
		this.playWaiting = false;
		this.animationFinished = false;
		if(this.currentAnimation){
			this.anim.gotoAndPlay(this.currentAnimation);
		}
	};
	var proto = component.prototype;
	
	proto['handle-render-load'] = function(obj){
		var self = this,
		over     = false;
		
		this.stage = obj.stage;
		if(!this.stage){
			console.warn('No CreateJS Stage, removing render component from "' + this.owner.type + '".');
			this.owner.removeComponent(this);
			return;
		}
		this.stage.addChild(this.anim);
		
		// The following appends necessary information to displayed objects to allow them to receive touches and clicks
		if(this.click || this.touch){
			if(this.touch && createjs.Touch.isSupported()){
				createjs.Touch.enable(this.stage);
			}

			this.anim.onPress     = function(event) {
				self.owner.trigger('mousedown', {
					//debug: true,
					event: event.nativeEvent,
					over: over,
					x: event.stageX,
					y: event.stageY,
					entity: self.owner
				});
				event.onMouseUp = function(event){
					self.owner.trigger('mouseup', {
						//debug: true,
						event: event.nativeEvent,
						over: over,
						x: event.stageX,
						y: event.stageY,
						entity: self.owner
					});
				};
				event.onMouseMove = function(event){
					self.owner.trigger('mousemove', {
						event: event.nativeEvent,
						over: over,
						x: event.stageX,
						y: event.stageY,
						entity: self.owner
					});
				};
			};
			this.anim.onMouseOut  = function(){over = false;};
			this.anim.onMouseOver = function(){over = true;};
		}
		if(this.hover){
			this.stage.enableMouseOver();
			this.anim.onMouseOut  = function(event){
				over = false;
				self.owner.trigger('mouseout', {
					event: event.nativeEvent,
					over: over,
					x: event.stageX,
					y: event.stageY,
					entity: self.owner
				});
			};
			this.anim.onMouseOver = function(event){
				over = true;
				self.owner.trigger('mouseover', {
					event: event.nativeEvent,
					over: over,
					x: event.stageX,
					y: event.stageY,
					entity: self.owner
				});
			};
		}
	};
	
	proto['handle-render'] = function(){
		var testCase = false, i = 0;
		this.anim.x = this.owner.x;
		this.anim.y = this.owner.y;
		this.anim.z = this.owner.z;
		
		if(this.stateChange){
			if(this.checkStates){
				for(; i < this.checkStates.length; i++){
					testCase = this.checkStates[i](this.state);
					if(testCase){
						if(this.currentAnimation !== testCase){
							if(this.animationFinished || (this.lastState >= +i)){
								this.currentAnimation = testCase;
								this.lastState = +i;
								this.animationFinished = false;
								this.anim.gotoAndPlay(testCase);
							} else {
								this.waitingAnimation = testCase;
								this.waitingState = +i;
							}
						}
						break;
					}
				}
			}
			this.stateChange = false;
		}
	};
	
	proto['logical-state'] = function(state){
		for(var i in state){
			if(this.state[i] !== state[i]){
				this.stateChange = true;
				this.state[i] = state[i];
			}
		}
	};
	
	// This function should never be called by the component itself. Call this.owner.removeComponent(this) instead.
	proto.destroy = function(){
		if (this.stage){
			this.stage.removeChild(this.anim);
			this.stage = undefined;
		}
		this.anim = undefined;
		this.removeListeners(this.listeners);
	};
	
	/*********************************************************************************************************
	 * The stuff below here will stay the same for all components. It's BORING!
	 *********************************************************************************************************/

	proto.addListeners = function(messageIds){
		for(var message in messageIds) this.addListener(messageIds[message]);
	};

	proto.removeListeners = function(listeners){
		for(var messageId in listeners) this.removeListener(messageId, listeners[messageId]);
	};
	
	proto.addListener = function(messageId, callback){
		var self = this,
		func = callback || function(value, debug){
			self[messageId](value, debug);
		};
		this.owner.bind(messageId, func);
		this.listeners[messageId] = func;
	};

	proto.removeListener = function(boundMessageId, callback){
		this.owner.unbind(boundMessageId, callback);
	};
	
	return component;
})();


/*--------------------------------------------------
 *   render-image - ../src/js/standard-components/render-image.js
 */
/**
# COMPONENT **render-image**
This component is attached to entities that will appear in the game world. It renders a static image. It can render a whole image or a portion of a larger images depending on the definition.

## Dependencies
- [[Handler-Render]] (on entity's parent) - This component listens for a render "handle-render" and "handle-render-load" message to setup and display the content.

## Messages

### Listens for:
- **handle-render** - Repositions the image in preparation for rendering
- **handle-render-load** - The image added to the stage. Setting up the mouse input stuff.
  > @param obj.stage ([createjs.Stage][link1]) - This is the stage on which the component will be displayed.

### Local Broadcasts:
- **mousedown** - Render-debug captures this message and uses it and then passes it on to the rest of the object in case it needs to do something else with it.
  > @param event (event object) - The event from Javascript.
  > @param over (boolean) - Whether the mouse is over the object or not.
  > @param x (number) - The x-location of the mouse in stage coordinates.
  > @param y (number) - The y-location of the mouse in stage coordinates.
  > @param entity ([[Entity]]) - The entity clicked on.  
- **mouseup** - Render-debug captures this message and uses it and then passes it on to the rest of the object in case it needs to do something else with it.
  > @param event (event object) - The event from Javascript.
  > @param over (boolean) - Whether the mouse is over the object or not.
  > @param x (number) - The x-location of the mouse in stage coordinates.
  > @param y (number) - The y-location of the mouse in stage coordinates.
  > @param entity ([[Entity]]) - The entity clicked on.  
- **mousemove** - Render-debug captures this message and uses it and then passes it on to the rest of the object in case it needs to do something else with it.
  > @param event (event object) - The event from Javascript.
  > @param over (boolean) - Whether the mouse is over the object or not.
  > @param x (number) - The x-location of the mouse in stage coordinates.
  > @param y (number) - The y-location of the mouse in stage coordinates.
  > @param entity ([[Entity]]) - The entity clicked on.  

## JSON Definition
    {
      "type": "render-image",
      "image": "example",
      //Required: The id of the image from the asset list in config.js.
      "source": {
      //Optional - The portion of the image you are going to use.
		"width":  100,
		"height": 100,
		"y": 100,
		"x": 100   
      },
      "acceptInput": {
      	//Optional - What types of input the object should take.
      	"hover": false;
      	"click": false; 
      }, 
      "regX": 0,
      //Optional - The X offset from X position for the image.
      "regY": 0,
      //Optional - The Y offset from Y position for the image.
      "scaleX": 1,
      //Optional - The X scaling factor for the image.  Will default to 1.
      "scaleY": 1
      //Optional - The Y scaling factor for the image.  Will default to 1.
    }
    
[link1]: http://createjs.com/Docs/EaselJS/Stage.html
*/

platformer.components['render-image'] = (function(){
	var component = function(owner, definition){
		var image = definition.image,
		source    = definition.source;
		
		this.owner = owner;
		
		if(definition.acceptInput){
			this.hover = definition.acceptInput.hover || false;
			this.click = definition.acceptInput.click || false;
		} else {
			this.hover = false;
			this.click = false;
		}
		
		// Messages that this component listens for
		this.listeners = [];

		this.addListeners(['handle-render-load', 'handle-render']);
		this.stage = undefined;
		this.image = new createjs.Bitmap(platformer.assets[image]);
		var scaleX = platformer.assets[image].scaleX || 1,
		scaleY     = platformer.assets[image].scaleY || 1;
		if(source){
			this.image.sourceRect = new createjs.Rectangle(source.x * scaleX, source.y * scaleY, source.width * scaleX, source.height * scaleY);
		}
		this.image.regX   = (definition.regX || 0) * scaleX;
		this.image.regY   = (definition.regY || 0) * scaleY;
		this.image.scaleX = ((definition.scaleX || 1) * (this.owner.scaleX || 1)) / scaleX;
		this.image.scaleY = ((definition.scaleY || 1) * (this.owner.scaleY || 1)) / scaleY;
	};
	var proto = component.prototype;
	
	proto['handle-render-load'] = function(obj){
		var self = this,
		over     = false;
		
		this.stage = obj.stage;
		this.stage.addChild(this.image);
		
		// The following appends necessary information to displayed objects to allow them to receive touches and clicks
		if(this.click){
			if(createjs.Touch.isSupported()){
				createjs.Touch.enable(this.stage);
			}

			this.image.onPress     = function(event) {
				self.owner.trigger('mousedown', {
					//debug: true,
					event: event.nativeEvent,
					over: over,
					x: event.stageX,
					y: event.stageY,
					entity: self.owner
				});
				event.onMouseUp = function(event){
					self.owner.trigger('mouseup', {
						//debug: true,
						event: event.nativeEvent,
						over: over,
						x: event.stageX,
						y: event.stageY,
						entity: self.owner
					});
				};
				event.onMouseMove = function(event){
					self.owner.trigger('mousemove', {
						event: event.nativeEvent,
						over: over,
						x: event.stageX,
						y: event.stageY,
						entity: self.owner
					});
				};
			};
			this.image.onMouseOut  = function(){over = false;};
			this.image.onMouseOver = function(){over = true;};
		}
		if(this.hover){
			this.stage.enableMouseOver();
			this.image.onMouseOut  = function(event){
				over = false;
				self.owner.trigger('mouseout', {
					event: event.nativeEvent,
					over: over,
					x: event.stageX,
					y: event.stageY,
					entity: self.owner
				});
			};
			this.image.onMouseOver = function(event){
				over = true;
				self.owner.trigger('mouseover', {
					event: event.nativeEvent,
					over: over,
					x: event.stageX,
					y: event.stageY,
					entity: self.owner
				});
			};
		}
	};
	
	proto['handle-render'] = function(obj){
		this.image.x = this.owner.x;
		this.image.y = this.owner.y;
		this.image.z = this.owner.z;
	};
	
	// This function should never be called by the component itself. Call this.owner.removeComponent(this) instead.
	proto.destroy = function(){
		this.stage.removeChild(this.image);
		this.stage = undefined;
		this.image = undefined;
		this.removeListeners(this.listeners);
		this.owner = undefined;
	};
	
	/*********************************************************************************************************
	 * The stuff below here will stay the same for all components. It's BORING!
	 *********************************************************************************************************/

	proto.addListeners = function(messageIds){
		for(var message in messageIds) this.addListener(messageIds[message]);
	};

	proto.removeListeners = function(listeners){
		for(var messageId in listeners) this.removeListener(messageId, listeners[messageId]);
	};
	
	proto.addListener = function(messageId, callback){
		var self = this,
		func = callback || function(value, debug){
			self[messageId](value, debug);
		};
		this.owner.bind(messageId, func);
		this.listeners[messageId] = func;
	};

	proto.removeListener = function(boundMessageId, callback){
		this.owner.unbind(boundMessageId, callback);
	};
	
	return component;
})();


/*--------------------------------------------------
 *   logic-button - ../src/js/standard-components/logic-button.js
 */
/**
# COMPONENT **logic-button**
This component handles the pressed/released state of a button according to input. It can be set as a toggle button or a simple press-and-release button.

## Dependencies:
- [[Handler-Logic]] (on entity's parent) - This component listens for a logic tick message to maintain and update its state.

## Messages

### Listens for:
- **handle-logic** - On a `tick` logic message, the component updates its current state and broadcasts its logical state to the entity.
- **pressed** - on receiving this message, the state of the button is set to "pressed".
- **released** - on receiving this message, the state of the button is set to "released".
- **mousedown** - on receiving this message, the state of the button is set to "pressed". Note that this component will not listen for "mousedown" if the component is in toggle mode.
- **mouseup** - on receiving this message, the state of the button is set to "released" unless in toggle mode, in which case it toggles between "pressed" and "released".

### Local Broadcasts:
- **logical-state** - this component will trigger this message with both "pressed" and "released" properties denoting its state. Both of these work in tandem and never equal each other.
  > @param message.pressed (boolean) - whether the button is in a pressed state.
  > @param message.released (boolean) - whether the button is in a released state.

## JSON Definition:
    {
      "type": "logic-button",
      
      "toggle": true,
      // Optional. Determines whether this button should behave as a toggle. Defaults to "false".
      
      "state": "pressed",
      // Optional. Specifies starting state of button; typically only useful for toggle buttons. Defaults to "released".
    }
*/
platformer.components['logic-button'] = (function(){
	var component = function(owner, definition){
		this.owner = owner;
		
		// Messages that this component listens for
		this.listeners = [];
		
		// Create state object to send with messages here so it's not recreated each time.
		this.state = {
			released: true,
			pressed: false
		};
		this.stateChange = true;

		if(definition.state === 'pressed'){
			this.pressed();
		}

		if(definition.toggle){
			this.toggle = true;
			this.addListener('mouseup');
		} else {
			this.addListeners(['mousedown','mouseup']);
		}
		
		this.addListeners(['handle-logic', 'pressed', 'released']);
	};
	var proto = component.prototype;
	
	proto['mousedown'] = proto['pressed'] = function(){
		if(this.state.released){
			this.stateChange = true;
			this.state.pressed = true;
			this.state.released = false;
		}
	};
	
	proto['mouseup'] = function(){
		if(this.toggle){
			if(this.state.pressed){
				this.released();
			} else {
				this.pressed();
			}
		} else {
			this.released();
		}
	};
	
	proto['released'] = function(){
		if(this.state.pressed){
			this.stateChange = true;
			this.state.pressed = false;
			this.state.released = true;
		}
	};
	
	proto['handle-logic'] = function(){
		if(this.stateChange){
			this.stateChange = false;
			this.owner.trigger('logical-state', this.state);
		}
	};

	
	// This function should never be called by the component itself. Call this.owner.removeComponent(this) instead.
	proto.destroy = function(){
		this.removeListeners(this.listeners);
		this.state = undefined;
		this.owner = undefined;
	};
	
	/*********************************************************************************************************
	 * The stuff below here will stay the same for all components. It's BORING!
	 *********************************************************************************************************/

	proto.addListeners = function(messageIds){
		for(var message in messageIds) this.addListener(messageIds[message]);
	};

	proto.removeListeners = function(listeners){
		for(var messageId in listeners) this.removeListener(messageId, listeners[messageId]);
	};
	
	proto.addListener = function(messageId, callback){
		var self = this,
		func = callback || function(value, debug){
			self[messageId](value, debug);
		};
		this.owner.bind(messageId, func);
		this.listeners[messageId] = func;
	};

	proto.removeListener = function(boundMessageId, callback){
		this.owner.unbind(boundMessageId, callback);
	};
	
	return component;
})();


/*--------------------------------------------------
 *   logic-carrier - ../src/js/standard-components/logic-carrier.js
 */
platformer.components['logic-carrier'] = (function(){
	var component = function(owner, definition){
		this.owner = owner;
		
		// Messages that this component listens for
		this.listeners = [];

		this.addListeners(['carry-me', 'release-me']);
		
	};
	var proto = component.prototype;
	
	proto['carry-me'] = function(resp){
		if(!this.owner.trigger('add-collision-entity', resp.entity)){
			// This message wasn't handled, so add a collision-group component and try again!
			this.owner.addComponent(new platformer.components['collision-group'](this.owner, {}));
			this.owner.trigger('add-collision-entity', this.owner);
			this.owner.trigger('add-collision-entity', resp.entity);
		}
	};
	
	proto['release-me'] = function(resp){
		this.owner.trigger('remove-collision-entity', resp.entity);
	};
	
	// This function should never be called by the component itself. Call this.owner.removeComponent(this) instead.
	proto.destroy = function(){
		this.removeListeners(this.listeners);
	};
	
	/*********************************************************************************************************
	 * The stuff below here will stay the same for all components. It's BORING!
	 *********************************************************************************************************/

	proto.addListeners = function(messageIds){
		for(var message in messageIds) this.addListener(messageIds[message]);
	};

	proto.removeListeners = function(listeners){
		for(var messageId in listeners) this.removeListener(messageId, listeners[messageId]);
	};
	
	proto.addListener = function(messageId, callback){
		var self = this,
		func = callback || function(value, debug){
			self[messageId](value, debug);
		};
		this.owner.bind(messageId, func);
		this.listeners[messageId] = func;
	};

	proto.removeListener = function(boundMessageId, callback){
		this.owner.unbind(boundMessageId, callback);
	};
	
	return component;
})();


/*--------------------------------------------------
 *   logic-directional-movement - ../src/js/standard-components/logic-directional-movement.js
 */
/**
# COMPONENT **logic-directional-movement**
This component changes the (x, y) position of an object according to its current speed and heading. It maintains its own heading information independent of other components allowing it to be used simultaneously with other logic components like [[Logic-Pushable]] and [[Logic-Gravity]]. It accepts directional messages that can stand alone, or come from a mapped controller, in which case it checks the `pressed` value of the message before changing its course accordingly.

## Dependencies:
- [[handler-logic]] (on entity's parent) - This component listens for a logic tick message to maintain and update its location.

## Messages

### Listens for:
- **handle-logic** - On a `tick` logic message, the component updates its location according to its current state.
  > @param message.deltaT - To determine how far to move the entity, the component checks the length of the tick.
- **[directional message]** - Directional messages include `go-down`, `go-south`, `go-down-left`, `go-southwest`, `go-left`, `go-west`, `go-up-left`, `go-northwest`, `go-up`, `go-north`, `go-up-right`, `go-northeast`, `go-right`, `go-east`, `go-down-right`, and `go-southeast`. On receiving one of these messages, the entity adjusts its movement orientation.
  > @param message.pressed (boolean) - Optional. If `message` is included, the component checks the value of `pressed`: true causes movement in the triggered direction, false turns off movement in that direction. Note that if no message is included, the only way to stop movement in a particular direction is to trigger `stop` on the entity before progressing in a new orientation. This allows triggering `up` and `left` in sequence to cause `up-left` movement on the entity.
- **stop** - Stops motion in all directions until movement messages are again received.
  > @param message.pressed (boolean) - Optional. If `message` is included, the component checks the value of `pressed`: a value of false will not stop the entity.

### Local Broadcasts:
- **logical-state** - this component will trigger this message when its movement or direction changes. Note that directions are not mutually exclusive: adjacent directions can both be true, establishing that the entity is facing a diagonal direction.
  > @param message.moving (boolean) - whether the entity is in motion.
  > @param message.left (boolean)   - whether the entity is facing left.
  > @param message.right (boolean)  - whether the entity is facing right.
  > @param message.up (boolean)     - whether the entity is facing up.
  > @param message.down (boolean)   - whether the entity is facing down.

## JSON Definition:
    {
      "type": "logic-directional-movement",
      
      "speed": 4.5
      // Optional. Defines the distance in world units that the entity should be moved per millisecond. Defaults to 0.3.
    }
*/
platformer.components['logic-directional-movement'] = (function(){
	var processDirection = function(direction){
		return function (state){
			if(state){
				this[direction] = state.pressed;
			} else {
				this[direction] = true;
			}
		};
	},
	component = function(owner, definition){
		this.owner = owner;
		
		// Messages that this component listens for
		this.listeners = [];

		this.addListeners(['handle-logic',
   		    'go-down',       'go-south',
   		    'go-down-left',  'go-southwest',
		    'go-left',       'go-west',
		    'go-up-left',    'go-northwest',
		    'go-up',         'go-north',
		    'go-up-right',   'go-northeast',
		    'go-right',      'go-east',
		    'go-down-right', 'go-southeast',
		    'stop'
		]);
		
		this.speed = definition.speed || .3;

		this.state = {
			moving: false,
			left: false,
			right: false,
			up: false,
			down: false
		};
		
		this.moving = false;
		this.left = false;
		this.right = false;
		this.up = false;
		this.down = false;
		this.upLeft = false;
		this.upRight = false;
		this.downLeft = false;
		this.downRight = false;
	};
	var proto = component.prototype;
	
	proto['handle-logic'] = function(resp){
		var vX    = 0,
		vY        = 0,
		up        = this.up        || this.upLeft || this.downLeft,
		upLeft    = this.upLeft    || (this.up   && this.left),
		left      = this.left      || this.upLeft || this.downLeft,
		downLeft  = this.downLeft  || (this.down && this.left),
		down      = this.down      || this.downLeft || this.downRight,
		downRight = this.downRight || (this.down && this.right),
		right     = this.right     || this.upRight || this.downRight,
		upRight   = this.upRight   || (this.up   && this.right),
		stateChanged = false;
		
		if (this.up && this.down){
			this.moving = false;
		} else if (this.left && this.right) {
			this.moving = false;
		} else if (upLeft) {
			vX = -this.speed / 1.414;
			vY = -this.speed / 1.414;
			this.moving = true;
		} else if (upRight) {
			vY = -this.speed / 1.414;
			vX =  this.speed / 1.414;
			this.moving = true;
		} else if (downLeft) {
			vY =  this.speed / 1.414;
			vX = -this.speed / 1.414;
			this.moving = true;
		} else if (downRight) {
			vY =  this.speed / 1.414;
			vX =  this.speed / 1.414;
			this.moving = true;
		} else if(this.left)	{
			vX = -this.speed;
			this.moving = true;
		} else if (this.right) {
			vX =  this.speed;
			this.moving = true;
		} else if (this.up) {
			vY = -this.speed;
			this.moving = true;
		} else if (this.down) {
			vY =  this.speed;
			this.moving = true;
		} else {
			this.moving = false;
		}

		this.owner.x += (vX * resp.deltaT);
		this.owner.y += (vY * resp.deltaT);
		
		if(this.state.moving !== this.moving){
			this.state.moving = this.moving;
			stateChanged = true;
		}
		if(this.state.up !== up){
			this.state.up = up;
			stateChanged = true;
		}
		if(this.state.right !== right){
			this.state.right = right;
			stateChanged = true;
		}
		if(this.state.down !== down){
			this.state.down = down;
			stateChanged = true;
		}
		if(this.state.left !== left){
			this.state.left = left;
			stateChanged = true;
		}
		
		if(stateChanged){
			this.owner.trigger('logical-state', this.state);
		}
	};
	
	proto['go-down']       = proto['go-south']     = processDirection('down');
	proto['go-down-left']  = proto['go-southwest'] = processDirection('downLeft');
	proto['go-left']       = proto['go-west']      = processDirection('left');
	proto['go-up-left']    = proto['go-northwest'] = processDirection('upLeft');
	proto['go-up']         = proto['go-north']     = processDirection('up');
	proto['go-up-right']   = proto['go-northeast'] = processDirection('upRight');
	proto['go-right']      = proto['go-east']      = processDirection('right');
	proto['go-down-right'] = proto['go-southeast'] = processDirection('downRight');

	proto['stop'] = function(state){
		if(!state || state.pressed)
		{
			this.down = false;
			this.downLeft = false;
			this.left = false;
			this.upLeft = false;
			this.up = false;
			this.upRight = false;
			this.right = false;
			this.downRight = false;
		}
	};

	// This function should never be called by the component itself. Call this.owner.removeComponent(this) instead.
	proto.destroy = function(){
		this.removeListeners(this.listeners);
		this.owner = undefined;
	};
	
	/*********************************************************************************************************
	 * The stuff below here will stay the same for all components. It's BORING!
	 *********************************************************************************************************/

	proto.addListeners = function(messageIds){
		for(var message in messageIds) this.addListener(messageIds[message]);
	};

	proto.removeListeners = function(listeners){
		for(var messageId in listeners) this.removeListener(messageId, listeners[messageId]);
	};
	
	proto.addListener = function(messageId, callback){
		var self = this,
		func = callback || function(value, debug){
			self[messageId](value, debug);
		};
		this.owner.bind(messageId, func);
		this.listeners[messageId] = func;
	};

	proto.removeListener = function(boundMessageId, callback){
		this.owner.unbind(boundMessageId, callback);
	};
	
	return component;
})();


/*--------------------------------------------------
 *   logic-gravity - ../src/js/standard-components/logic-gravity.js
 */
/**
# COMPONENT **logic-gravity**
A component that causes the object to move according to a specified gravity.

## Dependencies
- [[Handler-Logic]] (on entity's parent) - This component listens for a "handle-logic" message. It then moves the entity according to the gravitational forces.
- [[Collision-Basic]] (on entity) - Not required if this object doesn't collide with things. This component listens for the message 'hit-solid' from the collision-basic component.

## Messages

### Listens for:
- **handle-logic** - Accelerates and moves the objects according to the gravity set. Objects will not move faster than the max velocity set. Though this only velocity attributable to gravity.
  > @param resp.deltaT (number) - The time since the last tick.
- **hit-solid** - Received when we collide with an object is solid to the entity. We stop the movement in the direction of that object.
  > @param collisionInfo.x (number) - Either 1,0, or -1. 1 if we're colliding with an object on our right. -1 if on our left. 0 if not at all. 
  > @param collisionInfo.y (number) - Either 1,0, or -1. 1 if we're colliding with an object on our bottom. -1 if on our top. 0 if not at all. 

## JSON Definition
    {
      "type": "logic-pushable",
      "velocityX" : 0,
      //Optional - The starting x velocity of the entity. Defaults to 0.
	  "velocityY" : 0,
	  //Optional - The starting y velocity of the entity. Defaults to 0.
	  "maxVelocityX" : 3,
	  //Optional - The max x velocity attributed to the entity by gravity. Defaults to 3.
	  "maxVelocityY" : 3, 
	  //Optional - The max y velocity attributed to the entity by gravity. Defaults to 3.
	  "maxVelocity" : 3, 
	  //Optional - The max velocity attributed to the entity by gravity in both x and y. This is superseded by the specific maxVelocityX and maxVelocityY values. Defaults to 3.
	  "xGravity" : 0,
	  //Optional - The gravitational acceleration in units/millisecond that the entity moves in x. Defaults to 0.
	  "yGravity" : .01,
	  //Optional - The gravitational acceleration in units/millisecond that the entity moves in y. Defaults to .01.
	  "gravity" : 0
	  //Optional - The gravitational acceleration in units/millisecond that the entity moves in y. This is superseded by the specific yGravity. Defaults to .01.
    }
*/

platformer.components['logic-gravity'] = (function(){
	var component = function(owner, definition){
		this.owner = owner;
		var self = this;
		// Messages that this component listens for
		this.listeners = [];

		this.addListeners(['handle-logic', 'hit-solid']);
		
		this.vX = definition.velocityX || 0; 
		this.vY = definition.velocityY || 0;
		this.maxVX = definition.maxVelocityX || definition.maxVelocity || 3;
		this.maxVY = definition.maxVelocityY || definition.maxVelocity || 3;
		this.yGravity = definition.gravity || definition.yGravity || .01;
		this.xGravity = definition.xGravity || 0;
	};
	var proto = component.prototype;
	
	proto['handle-logic'] = function(resp){
		var deltaT = resp.deltaT;
		
		this.vY += this.yGravity * deltaT;
		if (this.vY > this.maxVY)
		{
			this.vY = this.maxVY;
		}
		this.vX += this.xGravity * deltaT;
		if (this.vX > this.maxVX)
		{
			this.vX = this.maxVX;
		}
		
		this.owner.x += (this.vX * deltaT);
		this.owner.y += (this.vY * deltaT);
	};
	
	proto['hit-solid'] = function(collisionInfo){
		if(((collisionInfo.y > 0) && (this.vY > 0)) || ((collisionInfo.y < 0) && (this.vY < 0))){
			this.vY = 0;
		} else if(((collisionInfo.y < 0) && (this.vX < 0)) || ((collisionInfo.x > 0) && (this.vX > 0))){
			this.vX = 0;
		}
		return true;
	};
	
	// This function should never be called by the component itself. Call this.owner.removeComponent(this) instead.
	proto.destroy = function(){
		this.removeListeners(this.listeners);
		this.owner = undefined;
	};
	
	/*********************************************************************************************************
	 * The stuff below here will stay the same for all components. It's BORING!
	 *********************************************************************************************************/

	proto.addListeners = function(messageIds){
		for(var message in messageIds) this.addListener(messageIds[message]);
	};

	proto.removeListeners = function(listeners){
		for(var messageId in listeners) this.removeListener(messageId, listeners[messageId]);
	};
	
	proto.addListener = function(messageId, callback){
		var self = this,
		func = callback || function(value, debug){
			self[messageId](value, debug);
		};
		this.owner.bind(messageId, func);
		this.listeners[messageId] = func;
	};

	proto.removeListener = function(boundMessageId, callback){
		this.owner.unbind(boundMessageId, callback);
	};
	
	return component;
})();


/*--------------------------------------------------
 *   logic-portable - ../src/js/standard-components/logic-portable.js
 */
platformer.components['logic-portable'] = (function(){
	var component = function(owner, definition){
		this.owner = owner;
		var self = this;
		// Messages that this component listens for
		this.listeners = [];

		this.addListeners(['handle-logic', 'collision-postponement-resolved', 'hit-solid']);
		
		this.portableDirections = definition.portableDirections || {
			down: true //default is false, 'true' means as soon as carrier is connected downward
		};

        this.carrier      = this.lastCarrier = undefined;
        this.message      = {
        	entity: this.owner,
        	debug: true
        };
	};
	var proto = component.prototype;
	
	proto['handle-logic'] = function(resp){
		if(this.carrierConnected){
			if(this.carrier != this.lastCarrier){
				if(this.lastCarrier){
					this.lastCarrier.trigger('release-me', this.message);
				}
				this.carrier.trigger('carry-me', this.message);
			}
			
			this.carrierConnected = false;
		} else {
			if(this.carrier){
				this.carrier.trigger('release-me', this.message);
				this.carrier = undefined;
			}
		}
		this.lastCarrier = this.carrier;
	};
	
	proto['hit-solid'] = function(collisionInfo){
		if(collisionInfo.y > 0){
			this.updateCarrier(collisionInfo.entity, 'down',  collisionInfo.shape);
		} else if(collisionInfo.y < 0){
			this.updateCarrier(collisionInfo.entity, 'up',    collisionInfo.shape);
		} else if(collisionInfo.x < 0){
			this.updateCarrier(collisionInfo.entity, 'left',  collisionInfo.shape);
		} else if(collisionInfo.x > 0){
			this.updateCarrier(collisionInfo.entity, 'right', collisionInfo.shape);
		}
	};
	
	proto.updateCarrier = function(entity, direction, shape){
		if(this.portableDirections[direction]){
			if(entity){
				if (entity !== this.carrier){
					this.carrier = entity;
				}
				this.carrierConnected = true;
			}
		}
	};	
	
	// This function should never be called by the component itself. Call this.owner.removeComponent(this) instead.
	proto.destroy = function(){
		this.removeListeners(this.listeners);
	};
	
	/*********************************************************************************************************
	 * The stuff below here will stay the same for all components. It's BORING!
	 *********************************************************************************************************/

	proto.addListeners = function(messageIds){
		for(var message in messageIds) this.addListener(messageIds[message]);
	};

	proto.removeListeners = function(listeners){
		for(var messageId in listeners) this.removeListener(messageId, listeners[messageId]);
	};
	
	proto.addListener = function(messageId, callback){
		var self = this,
		func = callback || function(value, debug){
			self[messageId](value, debug);
		};
		this.owner.bind(messageId, func);
		this.listeners[messageId] = func;
	};

	proto.removeListener = function(boundMessageId, callback){
		this.owner.unbind(boundMessageId, callback);
	};
	
	return component;
})();


/*--------------------------------------------------
 *   logic-pushable - ../src/js/standard-components/logic-pushable.js
 */
/**
# COMPONENT **logic-pushable**
A component that enables an entity to be pushed.

## Dependencies
- [[Handler-Logic]] (on entity's parent) - This component listens for a "handle-logic" message. It then moves the entity if it's being pushed.
- [[Collision-Basic]] (on entity) - This component listens for messages from the collision-basic component. In particular 'hit-solid' and 'push-entity' are coming from collision. 

## Messages

### Listens for:
- **handle-logic** - Checks to see if we're being pushed. If so, we get pushed. Then resets values.
  > @param resp.deltaT (number) - The time since the last tick.
- **push-entity** - Received when we collide with an object that can push us. We resolve which side we're colliding on and set up the currentPushX and currentPushY values so we'll move on the handle-logic call.
  > @param collisionInfo.x (number) - Either 1,0, or -1. 1 if we're colliding with an object on our right. -1 if on our left. 0 if not at all. 
  > @param collisionInfo.y (number) - Either 1,0, or -1. 1 if we're colliding with an object on our bottom. -1 if on our top. 0 if not at all.
- **hit-solid** - Called when the entity collides with a solid object. Stops the object from being pushed further in that direction.
  > @param collisionInfo.x (number) - Either 1,0, or -1. 1 if we're colliding with an object on our right. -1 if on our left. 0 if not at all. 
  > @param collisionInfo.y (number) - Either 1,0, or -1. 1 if we're colliding with an object on our bottom. -1 if on our top. 0 if not at all.

## JSON Definition
    {
      "type": "logic-pushable",
       "xPush" : .01,
	  //Optional - The distance per millisecond this object can be pushed in x. Defaults to .01.
	  "yPush" : .01,
	  //Optional - The distance per millisecond this object can be pushed in y. Defaults to .01.
	  "push" : .01
	  //Optional - The distance per millisecond this object can be pushed in x and y. Overwritten by the more specific values xPush and yPush. Defaults to .01.
    }
*/

platformer.components['logic-pushable'] = (function(){
	var component = function(owner, definition){
		this.owner = owner;
		var self = this;
		// Messages that this component listens for
		this.listeners = [];

		this.addListeners(['handle-logic', 'push-entity', 'hit-solid']);
		
		this.vX = 0; 
		this.vY = 0;
		/*
		this.maxVX = definition.maxVelocityX || definition.maxVelocity || 3;
		this.maxVY = definition.maxVelocityY || definition.maxVelocity || 3;
		*/
		this.yPush = definition.push || definition.yPush || .01;
		this.xPush = definition.push || definition.xPush || .01;
		this.currentPushX = 0;
		this.currentPushY = 0;
	};
	var proto = component.prototype;
	
	proto['handle-logic'] = function(resp){
		var deltaT = resp.deltaT;
		if(this.currentPushY){
			this.vY += (this.currentPushY / Math.abs(this.currentPushY)) * this.yPush * deltaT;
			/*
			if (this.vY > this.maxVY)
			{
				this.vY = this.maxVY;
			}
			*/
		}
		if(this.currentPushX){
			this.vX += (this.currentPushX / Math.abs(this.currentPushX)) * this.xPush * deltaT;
			/*
			if (this.vX > this.maxVX)
			{
				this.vX = this.maxVX;
			}
			*/
		}
		
		this.owner.x += (this.vX * deltaT);
		this.owner.y += (this.vY * deltaT);
		
		this.currentPushX = 0;
		this.currentPushY = 0;
		this.vX = 0;
		this.vY = 0;
	};
	
	proto['push-entity'] = function(collisionInfo){
		this.currentPushX -= (collisionInfo.x || 0);
		this.currentPushY -= (collisionInfo.y || 0);
	};
	
	proto['hit-solid'] = function(collisionInfo){
		if(((collisionInfo.y > 0) && (this.vY > 0)) || ((collisionInfo.y < 0) && (this.vY < 0))){
			this.vY = 0;
		} else if(((collisionInfo.x < 0) && (this.vX < 0)) || ((collisionInfo.x > 0) && (this.vX > 0))){
			this.vX = 0;
		}
		return true;
	};
	
	// This function should never be called by the component itself. Call this.owner.removeComponent(this) instead.
	proto.destroy = function(){
		this.removeListeners(this.listeners);
		this.owner = undefined;
	};
	
	/*********************************************************************************************************
	 * The stuff below here will stay the same for all components. It's BORING!
	 *********************************************************************************************************/

	proto.addListeners = function(messageIds){
		for(var message in messageIds) this.addListener(messageIds[message]);
	};

	proto.removeListeners = function(listeners){
		for(var messageId in listeners) this.removeListener(messageId, listeners[messageId]);
	};
	
	proto.addListener = function(messageId, callback){
		var self = this,
		func = callback || function(value, debug){
			self[messageId](value, debug);
		};
		this.owner.bind(messageId, func);
		this.listeners[messageId] = func;
	};

	proto.removeListener = function(boundMessageId, callback){
		this.owner.unbind(boundMessageId, callback);
	};
	
	return component;
})();


/*--------------------------------------------------
 *   counter - ../src/js/standard-components/counter.js
 */
/**
# COMPONENT **counter**
A simple component that keeps count of something and sends messages each time the count changes.

## Messages

### Listens for:
- **change-count** - Changes the count to the given value.
  > @param data.count (number) - The new count value.
- **[change-count message from definition]** - If the entity has multiple counters, you can define a message specific to each counter that will be translated into a change-count call within the object.
  > @param data.count (number) - The new count value.

### Local Broadcasts:
- **update-content** - A call used to notify other components that the count has changed.
  > @param message.text (string) - The count.
  
## JSON Definition
    {
      "type": "counter",
      
      "message" : "coin-change-count"
      //Optional - An alternate message to change-count. Used in the case that you have two counters on the same entity and want to talk to a specific one.
    }
*/

platformer.components['counter'] = (function(){
	var component = function(owner, definition){
		this.owner = owner;
		
		// Messages that this component listens for
		this.listeners = [];

		this.count = 0;
		if(definition.message)
		{
			this.addListener(definition.message);
			this[definition.message] = this['change-count'];
		}
		this.addListeners(['change-count']);
		
		this.message = {
		    text: ''
		};
	};
	var proto = component.prototype;
	
	proto['change-count'] = function(data){
		this.count = data.count;
		this.message.text = '' + this.count;
		this.owner.trigger('update-content', this.message);
	};
	
	// This function should never be called by the component itself. Call this.owner.removeComponent(this) instead.
	proto.destroy = function(){
		this.removeListeners(this.listeners);
		this.owner = undefined;
	};
	
	/*********************************************************************************************************
	 * The stuff below here will stay the same for all components. It's BORING!
	 *********************************************************************************************************/

	proto.addListeners = function(messageIds){
		for(var message in messageIds) this.addListener(messageIds[message]);
	};

	proto.removeListeners = function(listeners){
		for(var messageId in listeners) this.removeListener(messageId, listeners[messageId]);
	};
	
	proto.addListener = function(messageId, callback){
		var self = this,
		func = callback || function(value, debug){
			self[messageId](value, debug);
		};
		this.owner.bind(messageId, func);
		this.listeners[messageId] = func;
	};

	proto.removeListener = function(boundMessageId, callback){
		this.owner.unbind(boundMessageId, callback);
	};
	
	return component;
})();


/*--------------------------------------------------
 *   logic-timer - ../src/js/standard-components/logic-timer.js
 */
/**
# COMPONENT **logic-timer**
A timer that can used to trigger events. The timer can increment and decrement. It can be an interval timer, going off over and over. Has a max time which it will not exceed by default this is 1 hour.

## Dependencies
- [[Handler-Logic]] (on entity's parent) - This component listens for a "handle-logic" message to update the timer.

## Messages

### Listens for:
- **handle-logic** - Handles the update for the timer. Increments or decrements the current time. If it's hit the max it stops the timer at the max. If it hits the alarm it sets it off. Sends an update message indicating the timer's current time for other components to use.
  > @param data.deltaT (number) - The time passed since the last tick.
- **set** - Set the time.
  > @param data.time (number) - The new value for the time.
- **start** - Start the timer counting.
- **stop** - Stop the timer counting.

### Local Broadcasts:
- **[alarm message from definition]** - The definition.alarm value from the JSON definition is used as the message id. It's sent when the alarm goes off.
- **[update message from definition]** - The definition.update value from the JSON definition is used as the message id. It's sent every 'handle-logic' tick. 
  > @param message.time (number) - The current time value for the timer.

## JSON Definition
    {
      "type": "logic-timer",
      "time" : 0,
      //Optional - The starting time for the timer. Defaults to 0.
	  "alarmTime" : 10000,
	  //Optional - The time when the alarm will trigger the alarm message. Defaults to undefined, which never triggers the alarm.
	  "isInterval" : false,
	  //Optional - Whether or not the alarm fires at intervals of the alarmTime. Defaults to false.
	  "alarmMessage" : 'ding',
	  //Optional - The message sent when the alarm goes off. Defaults to ''.
	  "updateMessage" : '',
	  //Optional - The message sent when the timer updates. Defaults to ''.
	  "on" : true,
	  //Optional - Whether the alarm starts on. Defaults to true.
	  "isIncrementing" : true,
	  //Optional - Whether the timer is incrementing or decrementing. If the value is false it is decrementing. Defaults to true.
	  "maxTime" : 3600000
	  //Optional - The max value, positive or negative, that the timer will count to. At which it stops counting. Default to 3600000 which equals an hour.
    }
*/
platformer.components['logic-timer'] = (function(){
	var component = function(owner, definition){
		this.owner = owner;
		
		// Messages that this component listens for
		this.listeners = [];
		this.addListeners(['handle-logic', 'set-timer', 'start-timer', 'stop-timer']);
		this.time = this.owner.time || definition.time ||  0;
		this.prevTime = this.time;
		this.alarmTime = this.owner.alarmTime || definition.alarmTime || undefined;
		this.isInterval = this.owner.isInterval || definition.isInterval || false;
		this.alarmMessage =  this.owner.alarmMessage || definition.alarmMessage || '';
		this.updateMessage = this.owner.updateMessage || definition.updateMessage || '';
		this.isOn = this.owner.on || definition.on || true;
		this.isIncrementing = this.owner.isIncrementing || definition.isIncrementing || true;
		this.maxTime = this.owner.maxTime || definition.maxTime || 3600000; //Max time is 1hr by default.
	};
	var proto = component.prototype;
	
	proto['handle-logic'] = function(data){
		if (this.isOn)
		{
			this.prevTime = this.time;
			this.isIncrementing ? this.time += data.deltaT : this.time -= data.deltaT;
			if (Math.abs(this.time) > this.maxTime)
			{
				//If the timer hits the max time we turn it off so we don't overflow anything.
				if (this.time > 0)
				{
					this.time = this.maxTime;
				} else if (this.time < 0) {
					this.time = -this.maxTime;
				}
				this['stop-timer']();
			}
			
			if (typeof this.alarmTime !== 'undefined')
			{
				if (this.isInterval)
				{
					if (this.isIncrementing)
					{
						if ( Math.floor(this.time / this.alarmTime) > Math.floor(this.prevTime / this.alarmTime))
						{
							this.owner.trigger(this.alarmMessage);
						}
					} else {
						if ( Math.floor(this.time / this.alarmTime) < Math.floor(this.prevTime / this.alarmTime))
						{
							this.owner.trigger(this.alarmMessage);
						}
					}
				} else {
					if (this.isIncrementing)
					{
						if (this.time > this.alarmTime && this.prevTime < this.alarmTime)
						{
							this.owner.trigger(this.alarmMessage);
						}
					} else {
						if (this.time < this.alarmTime && this.prevTime > this.alarmTime)
						{
							this.owner.trigger(this.alarmMessage);
						}
					}
	 			}
			}
		}
		this.owner.trigger(this.updateMessage, {time: this.time});
	};
	
	proto['set-timer'] = function(data){
		this.time = data.time;
	};
	
	proto['start-timer'] = function(){
		this.isOn = true;
	};
	
	proto['stop-timer'] = function(){
		this.isOn = false;
	};
	
	// This function should never be called by the component itself. Call this.owner.removeComponent(this) instead.
	proto.destroy = function(){
		this.removeListeners(this.listeners);
		this.owner = undefined;
	};
	
	/*********************************************************************************************************
	 * The stuff below here will stay the same for all components. It's BORING!
	 *********************************************************************************************************/

	proto.addListeners = function(messageIds){
		for(var message in messageIds) this.addListener(messageIds[message]);
	};

	proto.removeListeners = function(listeners){
		for(var messageId in listeners) this.removeListener(messageId, listeners[messageId]);
	};
	
	proto.addListener = function(messageId, callback){
		var self = this,
		func = callback || function(value, debug){
			self[messageId](value, debug);
		};
		this.owner.bind(messageId, func);
		this.listeners[messageId] = func;
	};

	proto.removeListener = function(boundMessageId, callback){
		this.owner.unbind(boundMessageId, callback);
	};
	
	return component;
})();


/*--------------------------------------------------
 *   logic-teleporter - ../src/js/standard-components/logic-teleporter.js
 */
/**
# COMPONENT **logic-teleporter**
This component listens for redirected collision messages and fires a message on the colliding entity to specify where the colliding entity should relocate itself.

## Dependencies:
- [[Collision-Basic]] (on entity) - This component listens for collision messages on the entity.
- [[Entity-Container]] (on entity's parent) - This component listens for new peer entities being added on its parent to find its teleport destination.

## Messages

### Listens for:
- **load** - If the owner only teleports entities colliding from a certain side, this message fires `logical-state` to notify entity of current facing direction
- **peer-entity-added** - This teleporter listens as other entities are added so it can recognize the entity it should teleport colliding objects to.
  > @param message (object) - expects an entity as the message object in order to determine whether it is the requested teleportation destination.
- **teleport-entity** - On receiving this message, the component will fire `teleport` on the colliding entity, sending this.destination. The colliding entity must handle the `teleport` message and relocate itself.
  > @param message.x (integer) - uses `x` to determine if collision occurred on the left (-1) or right (1) of this entity.
  > @param message.y (integer) - uses `y` to determine if collision occurred on the top (-1) or bottom (1) of this entity.
  > @param message.entity (object) - triggers a `teleport` message on `entity`.

### Local Broadcasts:
- **logical-state** - On load, this component will send the state as the this.facing value if it exists.
  > @param message (object) - the current `this.facing` value is passed as a property of the message object: "facing-up", "facing-down", "facing-left", or "facing-right" set to `true`.

### Peer Broadcasts:
- **teleport** - On receiving a `teleport-entity` message, if the colliding entity is colliding on the teleporter's facing side, this message is triggered on the colliding entity.
  > @param message (object) - sends the destination entity as the message object, the x and y coordinates being the most important information for the listening entity.

## JSON Definition:
    {
      "type": "logic-teleporter",
      
      "facing": "up",
      // Optional: "up", "down", "left", or "right". Will only trigger "teleport" if colliding entity collides on the facing side of this entity. If nothing is specified, all collisions fire a "teleport" message on the colliding entity.
      
      "teleportId": "Destination entity's linkId property"
      // Required: String that matches the "linkId" property of the destination entity. This destination entity is passed on a "teleport" message so teleporting entity knows where to relocate.
    }
*/
platformer.components['logic-teleporter'] = (function(){

	var component = function(owner, definition){
		this.owner = owner;
		
		// Messages that this component listens for
		this.listeners = [];

		this.addListeners(['load', 'peer-entity-added', 'teleport-entity']);
		
		this.destination = undefined;
		this.linkId = this.owner.teleportId || definition.teleportId;
		this.facing = this.owner.facing || definition.facing || false;
	};
	var proto = component.prototype;
	
	proto['load'] = function(resp){
		var state = {};
		if(this.facing){
			state['facing-' + this.facing] = true;
			this.owner.trigger('logical-state', state);
		}
	};
	
	proto['peer-entity-added'] = function(entity){
		if(!this.destination && (entity.linkId === this.linkId)){
			this.destination = entity;
		}
	};
	
	proto['teleport-entity'] = function(collisionInfo){
		switch(this.facing){
		case 'up':
			if(collisionInfo.y < 0) {
				collisionInfo.entity.trigger('teleport', this.destination);
			}
			break;
		case 'right':
			if(collisionInfo.x > 0) {
				collisionInfo.entity.trigger('teleport', this.destination);
			}
			break;
		case 'down':
			if(collisionInfo.y > 0) {
				collisionInfo.entity.trigger('teleport', this.destination);
			}
			break;
		case 'left':
			if(collisionInfo.x < 0) {
				collisionInfo.entity.trigger('teleport', this.destination);
			}
			break;
		default:
			collisionInfo.entity.trigger('teleport', this.destination);
			break;
		}
	};
	
	// This function should never be called by the component itself. Call this.owner.removeComponent(this) instead.
	proto.destroy = function(){
		this.destination = undefined;
		this.removeListeners(this.listeners);
		this.owner = undefined;
	};
	
	/*********************************************************************************************************
	 * The stuff below here will stay the same for all components. It's BORING!
	 *********************************************************************************************************/

	proto.addListeners = function(messageIds){
		for(var message in messageIds) this.addListener(messageIds[message]);
	};

	proto.removeListeners = function(listeners){
		for(var messageId in listeners) this.removeListener(messageId, listeners[messageId]);
	};
	
	proto.addListener = function(messageId, callback){
		var self = this,
		func = callback || function(value){
			self[messageId](value);
		};
		this.owner.bind(messageId, func);
		this.listeners[messageId] = func;
	};

	proto.removeListener = function(boundMessageId, callback){
		this.owner.unbind(boundMessageId, callback);
	};
	
	return component;
})();


/*--------------------------------------------------
 *   logic-portal - ../src/js/standard-components/logic-portal.js
 */
/**
# COMPONENT **logic-portal**
A component which changes the scene when activated. When the portal receives an occupied message it sends the entity in that message notifying it. This message is meant to give the entity a chance to activate the portal in the manner it wants. The portal can also be activated by simply telling it to activate.

## Dependencies
- [[Handler-Logic]] (on entity's parent) - This component listens for a "handle-logic" message it then checks to see if it should change the scene if the portal is activated.
- [[Change-Scene]] (on entity) - This component listens for the "new-scene" message that the logic-portal sends and actually handles the scene changing.
- [[Collision-Basic]] (on entity) - Not required, but if we want the 'occupied-portal' call to fire on collision you'll need to have a collision-basic component on the portal.

## Messages

### Listens for:
- **handle-logic** - Checks to see if we should change scene if the portal is activated.
- **occupied-portal** - This message takes an entity and then sends the entity a 'portal-waiting' message. The idea behind this was that you could use it with collision. When an entity gets in front of the portal the collision sends this message, we then tell the entity that collided to do whatever it needs and then it calls back to activate the portal.
  > @param message.entity (entity Object) - The entity that will receive the 'portal-waiting' message.
- **activate-portal** - This message turns the portal on. The next 'handle-logic' call will cause a change of scene.

### Local Broadcasts:
- **new-scene** - Calls the 'change-scene' component to tell it to change scenes.
  > @param object.destination (string) - The id of the scene that we want to go to.

### Peer Broadcasts:
- **portal-waiting** - Informs another object that the portal is waiting on it to send the activate message.
  > @param entity - This is the portal entity. To be used so that the object can communicate with it directly.

## JSON Definition
    {
      "type": "name-of-component",
      "destination" : "level-2"
      //Required - The destination scene to which the portal will take us. In most cases this will come into the portal from Tiled where you'll set a property on the portal you place.
    }
*/
platformer.components['logic-portal'] = (function(){ //TODO: Change the name of the component!
	var component = function(owner, definition){
		this.owner = owner;
		
		// Messages that this component listens for
		this.listeners = [];

		this.addListeners(['handle-logic', 'occupied-portal', 'activate-portal']);
		this.destination = this.owner.destination || definition.destination;
		this.activated = false;
		this.used = false; 
	};
	var proto = component.prototype;
	
	
	proto['handle-logic'] = function(){
		if (!this.used && this.activated)
		{
			this.owner.trigger("new-scene", {scene: this.destination});
			this.used = true;
		}
	};
	
	proto['occupied-portal'] = function(message){
		var entity = message.entity; 
		entity.trigger('portal-waiting', this.owner);
	};
	
	proto['activate-portal'] = function()
	{
		this.activated = true;
	};
	
	// This function should never be called by the component itself. Call this.owner.removeComponent(this) instead.
	proto.destroy = function(){
		this.removeListeners(this.listeners);
		this.owner = undefined;
	};
	
	/*********************************************************************************************************
	 * The stuff below here will stay the same for all components. It's BORING!
	 *********************************************************************************************************/

	proto.addListeners = function(messageIds){
		for(var message in messageIds) this.addListener(messageIds[message]);
	};

	proto.removeListeners = function(listeners){
		for(var messageId in listeners) this.removeListener(messageId, listeners[messageId]);
	};
	
	proto.addListener = function(messageId, callback){
		var self = this,
		func = callback || function(value, debug){
			self[messageId](value, debug);
		};
		this.owner.bind(messageId, func);
		this.listeners[messageId] = func;
	};

	proto.removeListener = function(boundMessageId, callback){
		this.owner.unbind(boundMessageId, callback);
	};
	
	return component;
})();


/*--------------------------------------------------
 *   collision-basic - ../src/js/standard-components/collision-basic.js
 */
/**
# COMPONENT **collision-basic**
This component causes this entity to collide with other entities. It must be part of a collision group and will receive messages when colliding with other entities in the collision group.

## Dependencies:
- [[Collision-Group]] (on entity's parent) - This component listens for 'prepare-for-collision', 'relocate-entity', and 'hit-by' messages, commonly triggered by [[Collision-Group]] on the parent entity.

## Messages

### Listens for:
- **collide-on** - On receiving this message, the component triggers `add-collision-entity` on the parent.
- **collide-off** - On receiving this message, the component triggers `remove-collision-entity` on the parent.
- **prepare-for-collision** - Updates the axis-aligned bounding box for this entity in preparation for collision checks.
- **relocate-entity** - This message causes the entity's x,y coordinates to update.
  > @param message.x (number) - Required. The new x coordinate.
  > @param message.y (number) - Required. The new y coordinate.
  > @param message.relative (boolean) - Optional. Determines whether the provided x,y coordinates are relative to the entity's current position. Defaults to `false`.
- **hit-by-[collision-types specified in definition]** - When the entity collides with a listed collision-type, this message is received and re-triggered as a new message according to the component definition.

### Local Broadcasts
- **[Message specified in definition]** - On receiving a 'hit-by' message, custom messages are triggered on the entity corresponding with the component definition.

### Parent Broadcasts
- **add-collision-entity** - On receiving 'collide-on', this message is triggered on the parent.
- **remove-collision-entity** - On receiving 'collide-off', this message is triggered on the parent.

## JSON Definition:
    {
      "type": "collision-basic",
      
      "collisionType": "boulder",
      // Optional. Defines how this entity should be recognized by other colliding entities. Defaults to `none`.
      
      "immobile": true,
      // Optional. Defaults to `false`, but should be set to true if entity doesn't move for better optimization.
      
      "shape": {
      //Optional. Defines the shape of the collision area. Defaults to the width, height, regX, and regY properties of the entity.
      
        "type": "rectangle",
        // Optional. Defaults to "rectangle". Rectangles are currently the only supported shape.
        
        "offset": [0,-120]
        // Optional. Specifies the collision shape's position relative to the entity's x,y coordinates. Defaults to [0, 0].
        
        "points": [[-80,-120],[80, 120]]
        // Required. Specifies the top-left and bottom-right corners of the rectangle, with the center at [0,0].
      },
      
      "solidCollisions":{
      // Optional. Determines which collision types this entity should consider solid, meaning this entity should not pass through them.

        "boulder": "",
        // This specifies that this entity should not pass through other "boulder" collision-type entities.
        
        "diamond": "crack-up",
        // This specifies that this entity should not pass through "diamond" collision-type entities, but if it touches one, it triggers a "crack-up" message on the entity.

        "marble": ["flip", "dance", "crawl"]
        // This specifies that this entity should not pass through "marble" collision-type entities, but if it touches one, it triggers all three specified messages on the entity.
      },
      
      "softCollisions":{
      // Optional. Determines which collision types this entity should consider soft, meaning this entity may pass through them, but triggers collision messages on doing so.

        "water": "soaked",
        // This triggers a "soaked" message on the entity when it passes over a "water" collision-type entity.

        "lava": ["burn", "ouch"]
        // This triggers both messages on the entity when it passes over a "lava" collision-type entity.
      }
    }
*/
platformer.components['collision-basic'] = (function(){
	var entityBroadcast = function(event){
		if(typeof event === 'string'){
			return function(value){
				this.owner.trigger(event, value);
			};
		} else {
			return function(value){
				for (var e in event){
					this.owner.trigger(event[e], value);
				}
			};
		}
	};
	var component = function(owner, definition){
		var x  = 0; 
		var self   = this;
		
		this.owner    = owner;
		this.immobile = this.owner.immobile = this.owner.immobile || definition.immobile || false;
		this.lastX    = this.owner.x;
		this.lastY    = this.owner.y;
		this.xMomentum= 0;
		this.yMomentum= 0;
		this.aabb     = new platformer.classes.aABB();
		this.prevAABB = new platformer.classes.aABB();

		var shapes = [];
		if(definition.shapes)
		{
			shapes = definition.shapes;
		} else if (definition.shape) {
			shapes = [definition.shape];
		} else {
			var halfWidth = this.owner.width/2;
			var halfHeight = this.owner.height/2;
			var points = [[-halfWidth, -halfHeight],[halfWidth, halfHeight]];
			var offset = [(this.owner.regX?halfWidth-this.owner.regX:0), (this.owner.regY?halfHeight-this.owner.regY:0)];
			shapes = [{offset: offset, points: points, shape: 'rectangle'}];
		}
		
		// Messages that this component listens for
		this.listeners = [];

		this.addListeners(['collide-on',
		                   'collide-off',
		                   'prepare-for-collision', 
		                   'relocate-entity',
		                   'resolve-momentum']);
		this.shapes = [];
		this.entities = undefined;
		for (x in shapes){
			this.shapes.push(new platformer.classes.collisionShape([this.owner.x, this.owner.y], shapes[x].type, shapes[x].points, shapes[x].offset, shapes[x].radius));
			this.prevAABB.include(this.shapes[x].getAABB());
			this.aabb.include(this.shapes[x].getAABB());
		}

		this.owner.getAABB = function(){
			return self.getAABB();
		};
		this.owner.getPreviousAABB = function(){
			return self.getPreviousAABB();
		};
		this.owner.getShapes = function(){
			return self.getShapes();
		};
		this.owner.getPreviousX = function(){
			return self.lastX;
		};
		this.owner.getPreviousY = function(){
			return self.lastY;
		};
		
		this.owner.collisionType = definition.collisionType || 'none';
		//this.prevCollisionType = 'none';

		this.owner.solidCollisions = [];
		if(definition.solidCollisions){
			for(var i in definition.solidCollisions){
				this.owner.solidCollisions.push(i);
				if(definition.solidCollisions[i]){
					this.addListener('hit-by-' + i);
					this['hit-by-' + i] = entityBroadcast(definition.solidCollisions[i]);
				}
			}
		}

		this.owner.softCollisions = [];
		if(definition.softCollisions){
			for(var i in definition.softCollisions){
				this.owner.softCollisions.push(i);
				if(definition.softCollisions[i]){
					this.addListener('hit-by-' + i);
					this['hit-by-' + i] = entityBroadcast(definition.softCollisions[i]);
				}
			}
		}
	};
	var proto = component.prototype;
	
	proto['collide-on'] = function(){
		this.owner.parent.trigger('add-collision-entity', this.owner);
	};
	
	proto['collide-off'] = function(){
		this.owner.parent.trigger('remove-collision-entity', this.owner);
	};
	
	proto['prepare-for-collision'] = function(){
		this.prevAABB.setAll(this.aabb.x, this.aabb.y, this.aabb.width, this.aabb.height);
		this.aabb.reset();
		for (var x = 0; x < this.shapes.length; x++){
			this.shapes[x].update(this.owner.x, this.owner.y);
			this.aabb.include(this.shapes[x].getAABB());
		}
	};
	
	
	proto['relocate-entity'] = function(resp){
		if(resp.relative){
			this.owner.x = this.lastX + resp.x;
			this.owner.y = this.lastY + resp.y;
		} else {
			this.owner.x = resp.x;
			this.owner.y = resp.y;
		}

		this.aabb.reset();
		for (var x in this.shapes){
			this.shapes[x].reset(this.owner.x, this.owner.y);
			this.aabb.include(this.shapes[x].getAABB());
		}

		this.lastX = this.owner.x;
		this.lastY = this.owner.y;
		
		this.xMomentum = resp.xMomentum || 0;
		this.yMomentum = resp.yMomentum || 0;
	};
	
	proto['resolve-momentum'] = function(){
		this.owner.x += this.xMomentum;
		this.owner.y += this.yMomentum;
		this.xMomentum = 0;
		this.yMomentum = 0;
	};
	
	proto.getAABB = function(){
		return this.aabb;
	};
	
	proto.getPreviousAABB = function(){
		return this.prevAABB;
	};
	
	proto.getShapes = function(){
		var shapes = this.shapes.slice();
		
/*		if(this.entities && (this.entities.length > 1)){
			for (var x = 0; x < this.entities.length; x++){
				if(this.entities[x] !== this.owner){
					shapes = shapes.concat(this.entities[x].shapes || this.entities[x].getShapes());
				}
			}
		}*/
		return shapes;
	};

	// This function should never be called by the component itself. Call this.owner.removeComponent(this) instead.
	proto.destroy = function(){
		this.removeListeners(this.listeners);
	};
	
	/*********************************************************************************************************
	 * The stuff below here will stay the same for all components. It's BORING!
	 *********************************************************************************************************/

	proto.addListeners = function(messageIds){
		for(var message in messageIds) this.addListener(messageIds[message]);
	};

	proto.removeListeners = function(listeners){
		for(var messageId in listeners) this.removeListener(messageId, listeners[messageId]);
	};
	
	proto.addListener = function(messageId, callback){
		var self = this,
		func = callback || function(value, debug){
			self[messageId](value, debug);
		};
		this.owner.bind(messageId, func);
		this.listeners[messageId] = func;
	};

	proto.removeListener = function(boundMessageId, callback){
		this.owner.unbind(boundMessageId, callback);
	};
	
	return component;
})();


/*--------------------------------------------------
 *   collision-tiles - ../src/js/standard-components/collision-tiles.js
 */
/**
# COMPONENT **collision-tiles**
This component causes the tile-map to collide with other entities. It must be part of a collision group and will cause "hit-by-tile" messages to fire on colliding entities.

## Dependencies:
- [[Collision-Group]] (on entity's parent) - This component handles the collision state of the map for the [[Collision-Group]] component on the parent entity.
- [[CollisionShape]] object - This component uses collisionShape objects to expose individual tiles to the collision group.

## Methods

- **getTiles** - Returns all the collision tiles within the provided axis-aligned bounding box.
  > @param aabb ([[Aabb]]) - The axis-aligned bounding box for which tiles should be returned.
  > @return tiles (Array of objects) - Each returned object provides the shape [[collisionShape]] of the tile and the grid coordinates of the returned tile.
- **getAABB** - Returns the axis-aligned bounding box of the entire map.
  > @return aabb (object) - The returned object provides the top, left, width, and height of the collision map.
- **isTile** - Confirms whether a particular map grid coordinate contains a tile.
  > @param x (number) - Integer specifying the row of tiles in the collision map to check.
  > @param y (number) - Integer specifying the column of tiles in the collision map to check.
  > @return isTile (boolean) - Returns `true` if the coordinate contains a collision tile, `false` if it does not.

## JSON Definition:
    {
      "type": "collision-tiles",
      
      "collisionMap": [[-1,-1,-1], [1,-1,-1], [1,1,1]],
      // Required. A 2D array describing the tile-map with off (-1) and on (!-1) states.
      
      "tileWidth": 240,
      // Optional. The width of tiles in world coordinates. Defaults to 10.
      
      "tileHeight": 240,
      // Optional. The height of tiles in world coordinates. Defaults to 10.
    }
*/
platformer.components['collision-tiles'] = (function(){
	var component = function(owner, definition){
		var self = this;
		this.owner = owner;
		
		this.collisionMap   = definition.collisionMap   || [];
		this.tileWidth      = definition.tileWidth  || this.owner.tileWidth  || 10;
		this.tileHeight     = definition.tileHeight || this.owner.tileHeight || 10;
		this.tileHalfWidth  = this.tileWidth  / 2;
		this.tileHalfHeight = this.tileHeight / 2;
		
		// Messages that this component listens for
		this.listeners = [];
		
		this.owner.getTiles = function(aabb){
			return self.getTiles(aabb);
		};
		this.owner.getAABB = function(){
			return self.getAABB();
		};
		this.owner.isTile = function(x, y){
			return self.isTile(x, y);
		};
	};
	var proto = component.prototype;

	proto.getAABB = function(){
		return {
			left: 0,
			top:  0,
			right: this.tileWidth * this.collisionMap.length,
			bottom: this.tileHeight * this.collisionMap.length[0]
		};
	};
	
	proto.isTile = function (x, y) {
		if (x >=0 && x < this.collisionMap.length && y >=0 && y < this.collisionMap[0].length && this.collisionMap[x][y] != -1) 
		{
			return true;
		} else {
			//If there's not a tile or we're outside the map.
			return false;
		}
	};
	
	proto.getTiles = function(aabb){
		var left = Math.max(Math.floor(aabb.left   / this.tileWidth),  0),
		top      = Math.max(Math.floor(aabb.top    / this.tileHeight), 0),
		right    = Math.min(Math.ceil(aabb.right   / this.tileWidth),  this.collisionMap.length),
		bottom   = Math.min(Math.ceil(aabb.bottom  / this.tileHeight), this.collisionMap[0].length),
		x        = 0,
		y        = 0,
		tiles   = [];
		
		for (x = left; x < right; x++){
			for (y = top; y < bottom; y++){
				if (this.collisionMap[x][y] != -1) {
					tiles.push({ //TODO: Make some optimizations here. Remove creation of objects if possible. - DDD
								gridX: x,
								gridY: y,
								//type: this.collisionMap[x][y],
								shapes: [new platformer.classes.collisionShape([x * this.tileWidth + this.tileHalfWidth, y * this.tileHeight + this.tileHalfHeight], 'rectangle', [[-this.tileHalfWidth, -this.tileHalfHeight],[this.tileHalfWidth, this.tileHalfHeight]])]
								});
					
					//shapes.push(new platformer.classes.collisionShape([x * this.tileWidth + this.tileHalfWidth, y * this.tileHeight + this.tileHalfHeight], 'rectangle', [[-this.tileHalfWidth, -this.tileHalfHeight],[this.tileHalfWidth, this.tileHalfHeight]]));
				}
			}
		}
		
		return tiles;
	};
	
	// This function should never be called by the component itself. Call this.owner.removeComponent(this) instead.
	proto.destroy = function(){
		this.removeListeners(this.listeners);
	};
	
	/*********************************************************************************************************
	 * The stuff below here will stay the same for all components. It's BORING!
	 *********************************************************************************************************/
	
	proto.addListeners = function(messageIds){
		for(var message in messageIds) this.addListener(messageIds[message]);
	};

	proto.removeListeners = function(listeners){
		for(var messageId in listeners) this.removeListener(messageId, listeners[messageId]);
	};
	
	proto.addListener = function(messageId, callback){
		var self = this,
		func = callback || function(value, debug){
			self[messageId](value, debug);
		};
		this.owner.bind(messageId, func);
		this.listeners[messageId] = func;
	};

	proto.removeListener = function(boundMessageId, callback){
		this.owner.unbind(boundMessageId, callback);
	};
	
	return component;
})();


/*--------------------------------------------------
 *   ai-pacer - ../src/js/standard-components/ai-pacer.js
 */
/**
# COMPONENT **ai-pacer**
This component acts as a simple AI that will reverse the movement direction of an object when it collides with something.

## Dependencies:
- [[Collision-Basic]] (on entity) - This component listens for collision messages on the entity.
- [[Logic-Directional-Movement]] (on entity) - This component receives triggered messages from this component and moves the entity accordingly.
- [[Handler-Ai]] (on entity's parent) - This component listens for an ai "tick" message to orderly perform its control logic.

## Messages

### Listens for:
- **handle-ai** - This AI listens for a step message triggered by its entity parent in order to perform its logic on each tick.
- **turn-around** - On receiving this message, the component will check the collision side and re-orient itself accordingly.
  > @param message.x (integer) - uses `x` to determine if collision occurred on the left (-1) or right (1) of this entity.
  > @param message.y (integer) - uses `y` to determine if collision occurred on the top (-1) or bottom (1) of this entity.

### Local Broadcasts:
- **stop** - Triggered by this component before triggering another direction.
- **go-down**, **go-left**, **go-up**, **go-right** - Triggered in response to an entity colliding from the opposing side.

## JSON Definition:
    {
      "type": "ai-pacer",
      
      "movement": "horizontal",
      // Optional: "vertical", "horizontal", or "both". If nothing is specified, entity changes direction when colliding from any direction ("both").
      
      "direction": "up"
      // Optional: "up", "right", "down", or "left". This specifies the initial direction of movement. Defaults to "up", or "left" if `movement` is horizontal.
    }
*/
platformer.components['ai-pacer'] = (function(){
	var component = function(owner, definition){
		this.owner = owner;
		
		// Messages that this component listens for
		this.listeners = [];
		this.addListeners(['handle-ai', 'turn-around']);
		
		this.movement         = definition.movement  || 'both';
		this.lastDirection    = '';
		this.currentDirection = definition.direction || ((this.movement === 'horizontal')?'left':'up');
	};
	var proto = component.prototype;
	
	proto['handle-ai'] = function(obj){
		if(this.currentDirection !== this.lastDirection){
			this.lastDirection = this.currentDirection;
			this.owner.trigger('stop');
			this.owner.trigger('go-' + this.currentDirection);
		}
	};
	
	proto['turn-around'] = function(collisionInfo){
		if ((this.movement === 'both') || (this.movement === 'horizontal')){
			if(collisionInfo.x > 0){
				this.currentDirection = 'left';
			} else if (collisionInfo.x < 0) {
				this.currentDirection = 'right';
			}
		} 
		if ((this.movement === 'both') || (this.movement === 'vertical')){
			if(collisionInfo.y > 0){
				this.currentDirection = 'up';
			} else if (collisionInfo.y < 0) {
				this.currentDirection = 'down';
			}
		} 
	};
	
	
	// This function should never be called by the component itself. Call this.owner.removeComponent(this) instead.
	proto.destroy = function(){
		this.removeListeners(this.listeners);
	};
	
	/*********************************************************************************************************
	 * The stuff below here will stay the same for all components. It's BORING!
	 *********************************************************************************************************/

	proto.addListeners = function(messageIds){
		for(var message in messageIds) this.addListener(messageIds[message]);
	};

	proto.removeListeners = function(listeners){
		for(var messageId in listeners) this.removeListener(messageId, listeners[messageId]);
	};
	
	proto.addListener = function(messageId, callback){
		var self = this,
		func = callback || function(value, debug){
			self[messageId](value, debug);
		};
		this.owner.bind(messageId, func);
		this.listeners[messageId] = func;
	};

	proto.removeListener = function(boundMessageId, callback){
		this.owner.unbind(boundMessageId, callback);
	};
	
	return component;
})();


/*--------------------------------------------------
 *   render-gui - ../src/js/example-components/render-gui.js
 */
platformer.components['render-gui'] = (function(){
	var component = function(owner, definition){
		this.owner = owner;
		
		// Messages that this component listens for
		this.listeners = [];

		this.addListeners(['handle-render', 'handle-render-load', 'logic-gem-added', 'logic-gem-collected']);
		
		this.background = undefined;
		this.stage = undefined;
		
		var spriteSheetSpec = {
			images: definition.spriteSheet.images.slice(),
			frames: definition.spriteSheet.frames,
			animations: definition.spriteSheet.animations
		};
		for (var x = 0; x < spriteSheetSpec.images.length; x++)
		{
			spriteSheetSpec.images[x] = platformer.assets[spriteSheetSpec.images[x]];
		}
		var spriteSheet = new createjs.SpriteSheet(spriteSheetSpec);
		this.background = new createjs.BitmapAnimation(spriteSheet);
		this.currentAnimation = 'default';
		this.background.scaleX = this.owner.scaleX || 1;
		this.background.scaleY = this.owner.scaleY || 1;
		if(this.currentAnimation){
			this.background.gotoAndPlay(this.currentAnimation);
		}
	};
	var proto = component.prototype;
	
	proto['handle-render-load'] = function(resp){
		this.stage = resp.stage;
		this.stage.addChild(this.background);
		this.background.x = 200;
		this.background.y = 200;
		this.background.z = this.owner.z;
	};
	
	proto['handle-render'] = function(resp){
		
	};
	
	// This function should never be called by the component itself. Call this.owner.removeComponent(this) instead.
	proto.destroy = function(){
		this.removeListeners(this.listeners);
	};
	
	/*********************************************************************************************************
	 * The stuff below here will stay the same for all components. It's BORING!
	 *********************************************************************************************************/

	proto.addListeners = function(messageIds){
		for(var message in messageIds) this.addListener(messageIds[message]);
	};

	proto.removeListeners = function(listeners){
		for(var messageId in listeners) this.removeListener(messageId, listeners[messageId]);
	};
	
	proto.addListener = function(messageId, callback){
		var self = this,
		func = callback || function(value, debug){
			self[messageId](value, debug);
		};
		this.owner.bind(messageId, func);
		this.listeners[messageId] = func;
	};

	proto.removeListener = function(boundMessageId, callback){
		this.owner.unbind(boundMessageId, callback);
	};
	
	return component;
})();


/*--------------------------------------------------
 *   render-counter - ../src/js/example-components/render-counter.js
 */
platformer.components['render-counter'] = (function(){
	var component = function(owner, definition){
		this.owner = owner;
		
		// Messages that this component listens for
		this.listeners = [];

		this.addListeners(['handle-render', 'handle-render-load', 'refresh-count']);
		this.currentValue = 0;
		this.targetValue = 0;
		this.txt = new createjs.Text(this.currentValue.toString());
		this.txt.scaleX = definition.scaleX || this.owner.scaleX || 1;
		this.txt.scaleY = definition.scaleY || this.owner.scaleY || 1;
		this.txt.color = definition.color || '#000';
	};
	var proto = component.prototype;
	
	proto['handle-render-load'] = function(resp){
		//this.stage = resp.stage;
		this.txt.x = this.owner.x;
		this.txt.y = this.owner.y;
		this.txt.z = this.owner.z;
		this.txt.textAlign = "center";
		this.txt.textBaseline = "middle";
		resp.stage.addChild(this.txt);
	};
	
	proto['handle-render'] = function(){
		// Run loading code here
		if (this.currentValue != this.targetValue)
		{
			if (this.currentValue < this.targetValue)
			{
				this.currentValue++;
			}
			if (this.currentValue > this.targetValue)
			{
				this.currentValue--;
			}
			this.txt.text = this.currentValue;
		}
	};
	
	proto['refresh-count'] = function(data){
		this.targetValue = data;
	};
	
	// This function should never be called by the component itself. Call this.owner.removeComponent(this) instead.
	proto.destroy = function(){
		this.removeListeners(this.listeners);
	};
	
	/*********************************************************************************************************
	 * The stuff below here will stay the same for all components. It's BORING!
	 *********************************************************************************************************/

	proto.addListeners = function(messageIds){
		for(var message in messageIds) this.addListener(messageIds[message]);
	};

	proto.removeListeners = function(listeners){
		for(var messageId in listeners) this.removeListener(messageId, listeners[messageId]);
	};
	
	proto.addListener = function(messageId, callback){
		var self = this,
		func = callback || function(value, debug){
			self[messageId](value, debug);
		};
		this.owner.bind(messageId, func);
		this.listeners[messageId] = func;
	};

	proto.removeListener = function(boundMessageId, callback){
		this.owner.unbind(boundMessageId, callback);
	};
	
	return component;
})();


/*--------------------------------------------------
 *   render-clock - ../src/js/example-components/render-clock.js
 */
platformer.components['render-clock'] = (function(){
	var component = function(owner, definition){
		this.owner = owner;
		
		// Messages that this component listens for
		this.listeners = [];

		this.addListeners(['handle-render', 'handle-render-load', 'refresh-clock']);
		this.stage = undefined;
		this.currentValue = 0;
		this.targetValue = 0;
		this.txt = new createjs.Text(this.currentValue.toString());
		this.txt.scaleX = definition.scaleX || this.owner.scaleX || 1;
		this.txt.scaleY = definition.scaleY || this.owner.scaleY || 1;
		this.txt.color = definition.color || '#000';
	};
	var proto = component.prototype;
	
	proto['handle-render-load'] = function(resp){
		this.stage = resp.stage;
		this.txt.x = this.owner.x;
		this.txt.y = this.owner.y;
		this.txt.z = this.owner.z;
		this.txt.textAlign = "center";
		this.txt.textBaseline = "middle";
		this.stage.addChild(this.txt);
	};
	
	proto['handle-render'] = function(){
		this.txt.text = Math.floor(this.time / 1000).toString() + 'sec.';
	};
	
	proto['refresh-clock'] = function(data){
		this.time = data.time;
	};
	
	// This function should never be called by the component itself. Call this.owner.removeComponent(this) instead.
	proto.destroy = function(){
		this.stage.removeChild(this.txt);
		this.stage = undefined;
		this.txt = undefined;
		this.removeListeners(this.listeners);
	};
	
	/*********************************************************************************************************
	 * The stuff below here will stay the same for all components. It's BORING!
	 *********************************************************************************************************/

	proto.addListeners = function(messageIds){
		for(var message in messageIds) this.addListener(messageIds[message]);
	};

	proto.removeListeners = function(listeners){
		for(var messageId in listeners) this.removeListener(messageId, listeners[messageId]);
	};
	
	proto.addListener = function(messageId, callback){
		var self = this,
		func = callback || function(value, debug){
			self[messageId](value, debug);
		};
		this.owner.bind(messageId, func);
		this.listeners[messageId] = func;
	};

	proto.removeListener = function(boundMessageId, callback){
		this.owner.unbind(boundMessageId, callback);
	};
	
	return component;
})();


/*--------------------------------------------------
 *   logic-collectible-manager - ../src/js/example-components/logic-collectible-manager.js
 */
platformer.components['logic-collectible-manager'] = (function(){
	var component = function(owner, definition){
		this.owner = owner;
		
		// Messages that this component listens for
		this.listeners = [];

		this.addListeners(['load', 'peer-entity-added', 'gem-collected']);
		
		this.gemsCollected = 0;
		this.gemTotal = 0;
	};
	var proto = component.prototype;
	
	proto['load'] = function(resp){
		
	};
	
	proto['peer-entity-added'] = function(entity){
		if(entity.type == 'gem')
		{
			this.gemTotal++;
			//this.owner.trigger('logic-gem-added', {total: this.gemTotal});
		}
	};
	
	proto['gem-collected'] = function(resp){
		this.gemsCollected++;
		this.owner.trigger("broadcast-gem-collected", {count:this.gemsCollected});
	};
	
	// This function should never be called by the component itself. Call this.owner.removeComponent(this) instead.
	proto.destroy = function(){
		this.removeListeners(this.listeners);
	};
	
	/*********************************************************************************************************
	 * The stuff below here will stay the same for all components. It's BORING!
	 *********************************************************************************************************/

	proto.addListeners = function(messageIds){
		for(var message in messageIds) this.addListener(messageIds[message]);
	};

	proto.removeListeners = function(listeners){
		for(var messageId in listeners) this.removeListener(messageId, listeners[messageId]);
	};
	
	proto.addListener = function(messageId, callback){
		var self = this,
		func = callback || function(value, debug){
			self[messageId](value, debug);
		};
		this.owner.bind(messageId, func);
		this.listeners[messageId] = func;
	};

	proto.removeListener = function(boundMessageId, callback){
		this.owner.unbind(boundMessageId, callback);
	};
	
	return component;
})();


/*--------------------------------------------------
 *   logic-hero - ../src/js/example-components/logic-hero.js
 */
platformer.components['logic-hero'] = (function(){
	var component = function(owner, definition){
		this.owner = owner;
		var self = this;
		// Messages that this component listens for
		this.listeners = [];

		this.addListeners(['handle-logic', 'set-velocity', 'teleport', 'portal-waiting', 'key-left', 'key-right', 'key-up', 'key-down', 'key-jump', 'key-swing', 'hit-solid']);
		
		this.state = {
			air: false,
			ground: true,
			left: false,
			moving: false,
			right: true,
			swing: false,
			swingHit: false
		};
		
		this.left = false;
		this.right = false;
		this.jump = false;
		
		this.vX = 0; 
		this.vY = 0;
		this.aX = .25;
		this.fX = .4;
		this.maxVX = 2;
		this.maxVY = 3;
		this.aJump = 4;
		this.aGravity = .01;
		
		this.teleportDestination = undefined;
		this.justTeleported = false;
		
		this.hitGround = false;
	};
	var proto = component.prototype;
	
	proto['handle-logic'] = function(resp){
		var deltaT = resp.deltaT;
		
		if (this.teleportDestination)
		{
			this.owner.trigger('relocate-entity', this.teleportDestination);
			this.teleportDestination = undefined;
		} else {
			if(this.left) {
				this.vX -= this.aX * deltaT;
				if (this.vX < -this.maxVX) {
					this.vX = -this.maxVX;
				}
				this.state.left  = true;
				this.state.right = false;
			} else if (this.right) {
				this.vX += this.aX * deltaT;
				if (this.vX > this.maxVX)
				{
					this.vX = this.maxVX;
				}
				this.state.left  = false;
				this.state.right = true;
			} else {
				if (this.vX > 0)
				{
					this.vX -= this.fX * deltaT;
					if (this.vX < 0) {
						this.vX = 0;
					} 
				} else if (this.vX < 0)
				{
					this.vX += this.fX * deltaT;
					if (this.vX > 0) {
						this.vX = 0;
					} 
				} 
			}

			if (this.jump && this.state.ground) {
				this.vY = -this.aJump;
				this.state.air = true;
				this.state.ground = false;
				this.owner.trigger('jumping'); //This is for audio
			}
			
			this.vY += this.aGravity * deltaT;

			if (this.vY > this.maxVY) {
				this.vY = this.maxVY;
			//	} else if (this.vY < - this.maxVY) {
			//		this.vY = -this.maxVY;
			}
			
			this.owner.x += (this.vX * deltaT);
			this.owner.y += (this.vY * deltaT);
		}
		
		if (!this.hitGround)
		{
			this.state.air = true;
			this.state.ground = false;
		}
		this.hitGround = false;
		
		this.state.swingHit = false;
		if(this.swing){
			this.state.swing = true;
//			this.state.debug = true;
			if(this.swingInstance){
				this.state.swingHit = true;
				this.owner.parent.addEntity(new platformer.classes.entity(platformer.settings.entities['pickaxe'], {
					properties: {
						x: this.owner.x + (this.state.right?1:-1) * 140,
						y: this.owner.y
					}
				}));
			}
		} else {
			this.state.swing = false;
//			this.state.debug = false;
			if (this.state.ground) {
				if (this.vX == 0) {
					this.state.moving = false;
				} else {
					this.state.moving = true;
//					this.owner.trigger('walking'); //This is for audio
				}
			}
		}

		this.owner.trigger('logical-state', this.state);
		
		this.swingInstance = false;		
		
	};
	
	proto['teleport'] = function (posObj)
	{
//		this.owner.trigger('collide-off');
		this.teleportDestination = {x: posObj.x, y: posObj.y};
	};
	
	proto['portal-waiting'] = function (portal)
	{
		portal.trigger('activate-portal');
	};
	
	proto['set-velocity'] = function (velocityObj)
	{
		if (typeof velocityObj.vX !== "undefined")
		{
			this.vX = velocityObj.vX;
		}
		if (typeof velocityObj.vY !== "undefined")
		{
			this.vY = velocityObj.vY;
		}
	};
	
	proto['key-left'] = function (state)
	{
		this.left = state.pressed;
	};
	
	proto['key-right'] = function (state)
	{
		this.right = state.pressed;
	};
	
	proto['key-jump'] = function (state)
	{
		this.jump = state.pressed;
	};

	proto['key-swing'] = function (state)
	{
		if(state.pressed)
		{
			if(!this.swing){
				this.swing = true;
				this.swingInstance = true;
			}
		} else {
			this.swing = false;
		}
	};

	proto['hit-solid'] = function(value){
		if(value.y < 0){
			this.vY = 0;
		} else if(value.y > 0) {
			this.state.ground = true;
			this.state.air = false;
			this.hitGround = true;
			this.vY = 0; 
		}
	};
	
	// This function should never be called by the component itself. Call this.owner.removeComponent(this) instead.
	proto.destroy = function(){
		this.removeListeners(this.listeners);
	};
	
	/*********************************************************************************************************
	 * The stuff below here will stay the same for all components. It's BORING!
	 *********************************************************************************************************/

	proto.addListeners = function(messageIds){
		for(var message in messageIds) this.addListener(messageIds[message]);
	};

	proto.removeListeners = function(listeners){
		for(var messageId in listeners) this.removeListener(messageId, listeners[messageId]);
	};
	
	proto.addListener = function(messageId, callback){
		var self = this,
		func = callback || function(value, debug){
			self[messageId](value, debug);
		};
		this.owner.bind(messageId, func);
		this.listeners[messageId] = func;
	};

	proto.removeListener = function(boundMessageId, callback){
		this.owner.unbind(boundMessageId, callback);
	};
	
	return component;
})();


/*--------------------------------------------------
 *   logic-gem - ../src/js/example-components/logic-gem.js
 */
platformer.components['logic-gem'] = (function(){
	var component = function(owner, definition){
		this.owner = owner;
		var self = this;
		
		// Messages that this component listens for
		this.listeners = [];

		this.addListeners(['load', 'collect-gem', 'peer-entity-added']);
		
		this.manager = undefined;
	};
	var proto = component.prototype;
	
	
	proto['load'] = function(resp){
		this.owner.trigger('logical-state', {state: 'default'});
	};
	
	proto['peer-entity-added'] = function(entity){
		if(entity.type == 'collectible-manager')
		{
			this.manager = entity;
		}
	};
	
	proto['collect-gem'] = function(collisionInfo){
		if(this.manager)
		{
			this.manager.trigger('gem-collected');
		}
		this.owner.trigger('sound-collect-gem');
		this.owner.parent.removeEntity(this.owner);
	};
	
	// This function should never be called by the component itself. Call this.owner.removeComponent(this) instead.
	proto.destroy = function(){
		this.manager = undefined;
		this.removeListeners(this.listeners);
	};
	
	/*********************************************************************************************************
	 * The stuff below here will stay the same for all components. It's BORING!
	 *********************************************************************************************************/

	proto.addListeners = function(messageIds){
		for(var message in messageIds) this.addListener(messageIds[message]);
	};

	proto.removeListeners = function(listeners){
		for(var messageId in listeners) this.removeListener(messageId, listeners[messageId]);
	};
	
	proto.addListener = function(messageId, callback){
		var self = this,
		func = callback || function(value, debug){
			self[messageId](value, debug);
		};
		this.owner.bind(messageId, func);
		this.listeners[messageId] = func;
	};

	proto.removeListener = function(boundMessageId, callback){
		this.owner.unbind(boundMessageId, callback);
	};
	
	return component;
})();


/*--------------------------------------------------
 *   logic-gui - ../src/js/example-components/logic-gui.js
 */
platformer.components['logic-gui'] = (function(){
	var component = function(owner, definition){
		this.owner = owner;
		
		// Messages that this component listens for
		this.listeners = [];

		this.addListeners(['load', 'gui-gem-collected']);
	};
	var proto = component.prototype;
	
	proto['load'] = function(resp){
		this.owner.trigger('logical-state', {state: 'default'});
	};
	
	proto['gui-gem-collected'] = function(data){
		this.owner.trigger('count-gems', {count: data.count, debug: true});
	};
	
	// This function should never be called by the component itself. Call this.owner.removeComponent(this) instead.
	proto.destroy = function(){
		this.removeListeners(this.listeners);
	};
	
	/*********************************************************************************************************
	 * The stuff below here will stay the same for all components. It's BORING!
	 *********************************************************************************************************/

	proto.addListeners = function(messageIds){
		for(var message in messageIds) this.addListener(messageIds[message]);
	};

	proto.removeListeners = function(listeners){
		for(var messageId in listeners) this.removeListener(messageId, listeners[messageId]);
	};
	
	proto.addListener = function(messageId, callback){
		var self = this,
		func = callback || function(value, debug){
			self[messageId](value, debug);
		};
		this.owner.bind(messageId, func);
		this.listeners[messageId] = func;
	};

	proto.removeListener = function(boundMessageId, callback){
		this.owner.unbind(boundMessageId, callback);
	};
	
	return component;
})();


/*--------------------------------------------------
 *   logic-fps-counter - ../src/js/standard-components/logic-fps-counter.js
 */
platformer.components['logic-fps-counter'] = (function(){
	var component = function(owner, definition){
		this.owner = owner;
		
		// Messages that this component listens for
		this.listeners = [];
		this.addListeners(['handle-logic', 'toggle-visible', 'time-elapsed']);

		this.counter = {
			text: ''
		};
		this.times = {};
		this.timeElapsed = false;
		this.ticks = definition.ticks || 30; //number of ticks for which to take an average
		this.count = this.ticks;
	};
	var proto = component.prototype;
	
	proto['handle-logic'] = function(){
		if(this.timeElapsed){ //to make sure we're not including 0's from multiple logic calls between time elapsing.
			this.timeElapsed = false;
			this.count--;
			if(!this.count){
				this.count = this.ticks;
				var text = Math.floor(createjs.Ticker.getMeasuredFPS()) + " FPS<br />";
				for(var name in this.times){
					text += '<br />' + name + ': ' + Math.round(this.times[name] / this.ticks) + 'ms';
					this.times[name] = 0;
				}
				this.counter.text = text;
				this.owner.trigger('update-content', this.counter);
			}
		}
	};
	
	proto['toggle-visible'] = function(){
		this.counter.visible = !this.counter.visible;  
	};
	
	proto['time-elapsed'] = function(value){
		if(value){
			if(value.name){
				if((value.name === 'Engine Total') && !this.timeElapsed){
					this.timeElapsed = true;
				}
				if (!this.times[value.name]){
					this.times[value.name] = 0;
				}
				this.times[value.name] += value.time;
			}
		}
	};
	
	// This function should never be called by the component itself. Call this.owner.removeComponent(this) instead.
	proto.destroy = function(){
		this.counter = undefined;
		this.removeListeners(this.listeners);
	};
	
	/*********************************************************************************************************
	 * The stuff below here will stay the same for all components. It's BORING!
	 *********************************************************************************************************/

	proto.addListeners = function(messageIds){
		for(var message in messageIds) this.addListener(messageIds[message]);
	};

	proto.removeListeners = function(listeners){
		for(var messageId in listeners) this.removeListener(messageId, listeners[messageId]);
	};
	
	proto.addListener = function(messageId, callback){
		var self = this,
		func = callback || function(value, debug){
			self[messageId](value, debug);
		};
		this.owner.bind(messageId, func);
		this.listeners[messageId] = func;
	};

	proto.removeListener = function(boundMessageId, callback){
		this.owner.unbind(boundMessageId, callback);
	};
	
	return component;
})();


/*--------------------------------------------------
 *   Browser - ../src/js/browser.js
 */
/**
# Function
Browser.js is one large function that is used to discover what browser is being used the capabilities of the browser. In addition to browser type, we determine whether it is mobile or desktop, whether it supports multi or single-touch, what type of audio it can play, and whether it supports canvas or not. 
All of this information is added to platformer.settings.supports and used throughout the code, including when determine which layers to display (e.g. adding a button layer for mobile devices), and in audio so that we load and play the correct sound types. 
*/
(function(){
	var uagent   = navigator.userAgent.toLowerCase(),
	    
	    myAudio  = document.createElement('audio'),
	    
	    supports = {
			canvas:      false, // determined below
			touch:       !!('ontouchstart' in window),

			// specific browsers as determined above
			iPod:      (uagent.search('ipod')    > -1),
			iPhone:    (uagent.search('iphone')  > -1),
			iPad:      (uagent.search('ipad')    > -1),
			safari:    (uagent.search('safari')  > -1),
			ie:        (uagent.search('msie')    > -1),
		    firefox:   (uagent.search('firefox') > -1),
			android:   (uagent.search('android') > -1),
			silk:      (uagent.search('silk')    > -1),
			iOS:       false, //determined below
			mobile:    false, //determined below
			desktop:   false, //determined below
			multitouch:false, //determined below
			
			// audio support as determined below
			ogg:         true,
			m4a:         true,
			mp3:         true
		},
	    aspects = platformer.settings.aspects,
	    supportsAspects = {},
	    i = 0,
	    j = 0,
	    k = 0,
	    foundAspect = false,
	    listAspects = '';
	
	supports.iOS     = supports.iPod || supports.iPhone  || supports.iPad;
	supports.mobile  = supports.iOS  || supports.android || supports.silk;
	supports.desktop = !supports.mobile;
	
	//Determine multitouch:
	if(supports.touch){
		if (supports.android){
			if(parseInt(uagent.slice(uagent.indexOf("android") + 8)) > 2){
				supports.multitouch = true;
			}
		} else {
			supports.multitouch = true;
		}
	}
	
	// Determine audio support
	if ((myAudio.canPlayType) && !(!!myAudio.canPlayType && "" != myAudio.canPlayType('audio/ogg; codecs="vorbis"'))){
	    supports.ogg = false;
	    if(supports.ie || !(!!myAudio.canPlayType && "" != myAudio.canPlayType('audio/mp4'))){
	    	supports.m4a = false; //make IE use mp3's since it doesn't like the version of m4a made for mobiles
	    }
	}

	// Does the browser support canvas?
	var canvas = document.createElement('canvas');
	try	{
		supports.canvas = !!(canvas.getContext('2d')); // S60
	} catch(e) {
		supports.canvas = !!(canvas.getContext); // IE
	}
	delete canvas;

		//replace settings aspects build array with actual support of aspects
		platformer.settings.aspects = supportsAspects;
	platformer.settings.aspects = {};
	for (i in aspects){
		foundAspect = false;
		listAspects = '';
		for (j in aspects[i]){
			listAspects += ' ' + j;
			for (k in aspects[i][j]){
				if (uagent.search(aspects[i][j][k]) > -1){
					platformer.settings.aspects[j] = true;
					foundAspect = true;
					break;
				}
			}
			if(foundAspect) break;
		}
		if(!foundAspect){
			console.warn('This browser doesn\'t support any of the following: ' + listAspects);
		}
	}

	platformer.settings.supports = supports;

})();


/*--------------------------------------------------
 *   iOSAudio - ../src/js/HTMLiOSAudioPlugin.js
 */
/*
* HTMLiOSAudioPlugin for SoundJS
* 
* HTMLiOSAudioPlugin borrows heavily from HTMLAudioPlugin, with the
* sole goal of introducing a SoundJS plugin that works on iOS devices.
* The edits to enable this were written by Derek Detweiler.
*
* HTMLAudioPlugin for SoundJS
*
* Copyright (c) 2012 gskinner.com, inc.
*
* Permission is hereby granted, free of charge, to any person
* obtaining a copy of this software and associated documentation
* files (the "Software"), to deal in the Software without
* restriction, including without limitation the rights to use,
* copy, modify, merge, publish, distribute, sublicense, and/or sell
* copies of the Software, and to permit persons to whom the
* Software is furnished to do so, subject to the following
* conditions:
*
* The above copyright notice and this permission notice shall be
* included in all copies or substantial portions of the Software.
*
* THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND,
* EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES
* OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND
* NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT
* HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY,
* WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING
* FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR
* OTHER DEALINGS IN THE SOFTWARE.
*/

/**
 * @module SoundJS
 */

// namespace:
this.createjs = this.createjs||{};

(function() {

	/**
	 * Play sounds using HTML <audio> tags in the browser.
	 * @class HTMLiOSAudioPlugin
	 * @constructor
	 */
	function HTMLiOSAudioPlugin() {
		this.init();
	}

	var s = HTMLiOSAudioPlugin;

	/**
	 * The maximum number of instances that can be played. This is a browser limitation.
	 * @property MAX_INSTANCES
	 * @type Number
	 * @default 30
	 * @static
	 */
	s.MAX_INSTANCES = 30;

	/**
	 * The capabilities of the plugin.
	 * @property capabilities
	 * @type Object
	 * @default null
	 * @static
	 */
	s.capabilities = null;

	s.lastId = 0;

	// Event constants
	s.AUDIO_READY = "canplaythrough";
	s.AUDIO_ENDED = "ended";
	s.AUDIO_ERROR = "error"; //TODO: Handle error cases
	s.AUDIO_STALLED = "stalled";

	//TODO: Not used. Chrome can not do this when loading audio from a server.
	s.fillChannels = false;

	/**
	 * Determine if the plugin can be used.
	 * @method isSupported
	 * @return {Boolean} If the plugin can be initialized.
	 * @static
	 */
	s.isSupported = function() {
		s.generateCapabilities();
		var t = s.tag;
		if (t == null) { return false; }
		return true;
	};

	/**
	 * Determine the capabilities of the plugin.
	 * @method generateCapabiities
	 * @static
	 */
	s.generateCapabilities = function() {
		if (s.capabilities != null) { return; }
		var t = s.tag = document.createElement("audio");
		if (t.canPlayType == null) { return null; }
		var c = s.capabilities = {
			panning: false,
			volume: true,
			mp4: t.canPlayType("audio/mp4") != "no" && t.canPlayType("audio/mp4") != "",
			channels: s.MAX_INSTANCES
		};
	}

	var p = s.prototype = {

		capabilities: null,
		FT: 0.001,
		channels: null,

		init: function() {
			this.capabilities = s.capabilities;
			this.channels = {};
		},

		/**
		 * Pre-register a sound instance when preloading/setup.
		 * @method register
		 * @param {String} src The source of the audio
		 * @param {Number} instances The number of concurrently playing instances to allow for the channel at any time.
		 * @return {Object} A result object, containing a tag for preloading purposes.
		 */
		register: function(src, instances) {
			var channel = TagChannel.get(src);
			var tag;
			for (var i=0, l=instances||1; i<l; i++) {
				tag = this.createTag(src);
				channel.add(tag);
			}
			return {
				tag: tag // Return one instance for preloading purposes
			};
		},

		createTag: function(src) {
			var tag = document.createElement("audio");
			tag.preload = false;
			tag.src = src;
			//tag.type = "audio/ogg"; //LM: Need to set properly
			return tag;
		},

		/**
		 * Create a sound instance.
		 * @method create
		 * @param {String} src The source to use.
		 * @return {SoundInstance} A sound instance for playback and control.
		 */
		create: function(src) {
			var instance = new SoundInstance(src);
			instance.owner = this;
			return instance;
		},

		toString: function() {
			return "[HTMLiOSAudioPlugin]";
		}

	}

	createjs.HTMLiOSAudioPlugin = HTMLiOSAudioPlugin;


	/**
	 * Sound Instances are created when any calls to SoundJS.play() are made.
	 * The instances are returned by the active plugin for control by the user.
	 * Users can control audio directly through the instance.
	 * @class SoundInstance
	 * @param {String} src The path to the sound
	 * @constructor
	 */
	function SoundInstance(src) {
		this.init(src);
	}

	var p = SoundInstance.prototype = {

		//TODO: Fading out when paused/stopped?

		/**
		 * The source of the sound.
		 * @property src
		 * @type String
		 * @default null
		 */
		src: null,

		/**
		 * The unique ID of the instance
		 * @property uniqueId
		 * @type String | Number
		 * @default -1
		 */
		uniqueId:-1,

		/**
		 * The play state of the sound. Play states are defined as constants on SoundJS
		 * @property playState
		 * @type String
		 * @default null
		 */
		playState: null,

		/**
		 * The plugin that created the instance
		 * @property owner
		 * @type HTMLiOSAudioPlugin
		 * @default null
		 */
		owner: null,

		loaded: false,
		lastInterrupt: createjs.SoundJS.INTERRUPT_NONE,
		offset: 0,
		delay: 0,
		volume: 1,
		pan: 0,

		remainingLoops: 0,
		delayTimeout: -1,
		tag: null,


		/**
		 * Determines if the audio is currently muted.
		 * @property muted
		 * @type Boolean
		 * @default false
		 */
		muted: false,

		/**
		 * Determines if the audio is currently paused. If the audio has not yet started playing,
		 * it will be true, unless the user pauses it.
		 * @property paused
		 * @type Boolean
		 * @default false
		 */
		paused: false,


		/**
		 * The callback that is fired when a sound has completed playback
		 * @event onComplete
		 */
		onComplete: null,

		/**
		 * The callback that is fired when a sound has completed playback, but has loops remaining.
		 * @event onLoop
		 */
		onLoop: null,

		/**
		 * The callback that is fired when a sound is ready to play.
		 * @event onReady
		 */
		onReady: null,

		/**
		 * The callback that is fired when a sound has failed to start.
		 * @event onPlayFailed
		 */
		onPlayFailed: null,

		/**
		 * The callback that is fired when a sound has been interrupted.
		 * @event onPlayInterrupted
		 */
		onPlayInterrupted: null,

		// Proxies, make removing listeners easier.
		endedHandler: null,
		readyHandler: null,
		stalledHandler:null,

		// Constructor
		init: function(src) {
			this.uniqueId = createjs.HTMLiOSAudioPlugin.lastId++;
			this.src = src;
			this.endedHandler = createjs.SoundJS.proxy(this.handleSoundComplete, this);
			this.readyHandler = createjs.SoundJS.proxy(this.handleSoundReady, this);
			this.stalledHandler = createjs.SoundJS.proxy(this.handleSoundStalled, this);
		},

		cleanUp: function() {
			var tag = this.tag;
			if (tag != null) {
				tag.pause();
				try { tag.currentTime = 0; } catch (e) {} // Reset Position
				tag.removeEventListener(createjs.HTMLiOSAudioPlugin.AUDIO_ENDED, this.endedHandler, false);
				tag.removeEventListener(createjs.HTMLiOSAudioPlugin.AUDIO_READY, this.readyHandler, false);
				TagChannel.setInstance(this.src, tag);
				this.tag = null;
			}

			if (window.createjs == null) { return; }
			createjs.SoundJS.playFinished(this);
		},

		interrupt: function () {
			if (this.tag == null) { return; }
			this.playState = createjs.SoundJS.PLAY_INTERRUPTED;
			if (this.onPlayInterrupted) { this.onPlayInterrupted(this); }
			this.cleanUp();
			this.paused = false;
		},

	// Public API
		/**
		 * Play an instance. This API is only used to play an instance after it has been stopped
		 * or interrupted.`
		 * @method play
		 * @param {String} interrupt How this sound interrupts other instances with the same source. Interrupt values are defined as constants on SoundJS.
		 * @param {Number} delay The delay in milliseconds before the sound starts
		 * @param {Number} offset How far into the sound to begin playback.
		 * @param {Number} loop The number of times to loop the audio. Use -1 for infinite loops.
		 * @param {Number} volume The volume of the sound between 0 and 1.
		 * @param {Number} pan The pan of the sound between -1 and 1. Note that pan does not work for HTML Audio.
		 */
		play: function(interrupt, delay, offset, loop, volume, pan) {
			this.cleanUp();
			createjs.SoundJS.playInstance(this, interrupt, delay, offset, loop, volume, pan);
		},

		// Called by SoundJS when ready
		beginPlaying: function(offset, loop, volume, pan) {
			if (window.createjs == null) { return; }
			var tag = this.tag = TagChannel.getInstance(this.src);
			if (tag == null) { this.playFailed(); return -1; }

			tag.addEventListener(createjs.HTMLiOSAudioPlugin.AUDIO_ENDED, this.endedHandler, false);

			this.offset = offset;
			this.volume = volume;
			this.updateVolume();
			this.remainingLoops = loop;

			if (tag.readyState !== 4) {
				tag.addEventListener(createjs.HTMLiOSAudioPlugin.AUDIO_READY, this.readyHandler, false);
				tag.addEventListener(createjs.HTMLiOSAudioPlugin.AUDIO_STALLED, this.stalledHandler, false);
				tag.load();
			} else {
				this.handleSoundReady(null);
			}

			return 1;
		},

		handleSoundStalled: function(event) {
			if (this.onPlayFailed != null) { this.onPlayFailed(this); }
			this.cleanUp();
		},

		handleSoundReady: function(event) {
			if (window.createjs == null) { return; }
			this.playState = createjs.SoundJS.PLAY_SUCCEEDED;
			this.paused = false;
			this.tag.removeEventListener(createjs.HTMLiOSAudioPlugin.AUDIO_READY, this.readyHandler, false);

			if(this.offset >= this.getDuration()) {
				this.playFailed();
				return;
			} else if (this.offset > 0) {
				this.tag.currentTime = this.offset * 0.001;
			}
			if (this.remainingLoops == -1) { this.tag.loop = true; }
			this.tag.play();
		},

		/**
		 * Pause the instance.
		 * @method pause
		 * @return {Boolean} If the pause call succeeds.
		 */
		pause: function() {
			this.paused = true;
			// Note: when paused by user, we hold a reference to our tag. We do not release it until stopped.
			if (this.tag != null) {
				this.tag.pause();
				return false;
			}
			return true;
		},

		/**
		 * Resume a sound instance that has been paused.
		 * @method resume
		 * @return {Boolean} If the resume call succeeds.
		 */
		resume: function() {
			this.paused = false;
			if (this.tag != null) {
				this.tag.play();
				return false;
			}
			return true;
		},

		/**
		 * Stop a sound instance.
		 * @method stop
		 * @return {Boolean} If the stop call succeeds.
		 */
		stop: function() {
			this.pause();
			this.playState = createjs.SoundJS.PLAY_FINISHED;
			this.cleanUp();
			return true;
		},

		// Called by SoundJS
		setMasterVolume: function(value) {
			this.updateVolume();
			return true;
		},

		/**
		 * Set the volume of the sound instance.
		 * @method setVolume
		 * @param value
		 * @return {Boolean} If the setVolume call succeeds.
		 */
		setVolume: function(value) {
			this.volume = value;
			this.updateVolume();
			return true;
		},

		updateVolume: function() {
			if (this.tag != null) {
				this.tag.volume = this.muted ? 0 : this.volume * createjs.SoundJS.masterVolume;
				return true;
			} else {
				return false;
			}
		},

		/**
		 * Get the volume of the sound, not including how the master volume has affected it.
		 * @method getVolume
		 * @param value
		 * @return The volume of the sound.
		 */
		getVolume: function(value) {
			return this.volume;
		},

		/**
		 * Mute the sound.
		 * @method mute
		 * @param {Boolean} isMuted If the sound should be muted or not.
		 * @return {Boolean} If the mute call succeeds.
		 */
		mute: function(isMuted) {
			this.muted = isMuted;
			this.updateVolume();
			return true;
		},

		/**
		 * Set the pan of a sound instance. Note that this does not work in HTML audio.
		 * @method setPan
		 * @param {Number} value The pan value between -1 (left) and 1 (right).
		 * @return {Number} If the setPan call succeeds.
		 */
		setPan: function(value) { return false; }, // Can not set pan in HTML

		/**
		 * Get the pan of a sound instance. Note that this does not work in HTML audio.
		 * @method getPan
		 * @return {Number} The value of the pan between -1 (left) and 1 (right).
		 */
		getPan: function() { return 0; },

		/**
		 * Get the position of the playhead in the sound instance.
		 * @method getPosition
		 * @return {Number} The position of the playhead in milliseconds.
		 */
		getPosition: function() {
			if (this.tag == null) { return 0; }
			return this.tag.currentTime * 1000;
		},

		/**
		 * Set the position of the playhead in the sound instance.
		 * @method setPosition
		 * @param {Number} value The position of the playhead in milliseconds.
		 */
		setPosition: function(value) {
			if (this.tag == null) { return false; }
			try {
				this.tag.currentTime = value * 0.001;
			} catch(error) { // Out of range
				return false;
			}
			return true;
		},

		/**
		 * Get the duration of the sound instance.
		 * @method getDuration
		 * @return {Number} The duration of the sound instance in milliseconds.
		 */
        getDuration: function() {
            if (this.tag == null) { return 0; }
            return this.tag.duration * 1000;
        },

		handleSoundComplete: function(event) {
			if (this.remainingLoops != 0) {
				this.remainingLoops--;
				//try { this.tag.currentTime = 0; } catch(error) {}
				this.tag.play();
				if (this.onLoop != null) { this.onLoop(this); }
				return;
			}

			if (window.createjs == null) { return; }
			this.playState = createjs.SoundJS.PLAY_FINISHED;
			if (this.onComplete != null) { this.onComplete(this); }
			this.cleanUp();
		},

		// Play has failed
		playFailed: function() {
			if (window.createjs == null) { return; }
			this.playState = createjs.SoundJS.PLAY_FAILED;
			if (this.onPlayFailed != null) { this.onPlayFailed(this); }
			this.cleanUp();
		},

		toString: function() {
			return "[HTMLiOSAudioPlugin SoundInstance]";
		}

	};

	// Do not add to namespace.


	/**
	 * The TagChannel is an object pool for HTML tag instances.
	 * In Chrome, we have to pre-create the number of tag instances that we are going to play
	 * before we load the data, otherwise the audio stalls. (Note: This seems to be a bug in Chrome)
	 * @class TagChannel
	 * @param src The source of the channel.
	 * @private
	 */
	function TagChannel(src) {
		this.init(src);
	}

	/**
	 * Contains each sound channel, indexed by src.
	 * @private
	 */
	TagChannel.channels = {};
	/**
	 * Get a tag channel.
	 * @private
	 */
	TagChannel.get = function(src) {
		var channel = TagChannel.channels[src];
		if (channel == null) {
			channel = TagChannel.channels[src] = new TagChannel(src);
		}
		return channel;
	};

	/**
	 * Get a tag instance. This is a shortcut method.
	 * @private
	 */
	TagChannel.getInstance = function(src) {
		var channel = TagChannel.channels[src];
		if (channel == null) { return null; }
		return channel.get();
	};

	/** Return a tag instance. This is a shortcut method.
	 * @private
	 */
	TagChannel.setInstance = function(src, tag) {
		var channel = TagChannel.channels[src];
		if (channel == null) { return null; }
		return channel.set(tag);
	};

	TagChannel.prototype = {

		src: null,
		length: 0,
		available: 0,
		tags: null,

		init: function(src) {
			this.src = src;
			this.tags = [];
		},

		add: function(tag) {
			this.tags.push(tag);
			this.length++;
			this.available = this.tags.length;
		},

		get: function() {
			if (this.tags.length == 0) { return null; }
			this.available = this.tags.length;
			var tag = this.tags.pop();
			if(!tag.parentNode){
				document.body.appendChild(tag);
			}
			return tag;
		},

		set: function(tag) {
			var index = this.tags.indexOf(tag);
			if (index == -1) {
				this.tags.push(tag);
			}

//				document.body.removeChild(tag);

			this.available = this.tags.length;
		},

		toString: function() {
			return "[HTMLiOSAudioPlugin TagChannel]";
		}

		// do not add to namespace

	};

}());


/*--------------------------------------------------
 *   SoundJSm4a - ../src/js/SoundJSm4aOverride.js
 */
/*
* SoundJS
* Visit http://createjs.com/ for documentation, updates and examples.
*
* The edits to enable m4a were written by Derek Detweiler.
*
* Copyright (c) 2012 gskinner.com, inc.
*
* Permission is hereby granted, free of charge, to any person
* obtaining a copy of this software and associated documentation
* files (the "Software"), to deal in the Software without
* restriction, including without limitation the rights to use,
* copy, modify, merge, publish, distribute, sublicense, and/or sell
* copies of the Software, and to permit persons to whom the
* Software is furnished to do so, subject to the following
* conditions:
*
* The above copyright notice and this permission notice shall be
* included in all copies or substantial portions of the Software.
*
* THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND,
* EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES
* OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND
* NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT
* HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY,
* WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING
* FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR
* OTHER DEALINGS IN THE SOFTWARE.
*/


// namespace:
this.createjs = this.createjs||{};

/**
 * The SoundJS library manages the playback of audio in HTML, via plugins which
 * abstract the actual implementation, and allow multiple playback modes depending
 * on the environment.
 *
 * For example, a developer could specify:
 *   [WebAudioPlugin, HTML5AudioPlugin, FlashAudioPlugin]
 * In the latest browsers with webaudio support, a WebAudio plugin would be used,
 * other modern browsers could use HTML5 audio, and older browsers with no HTML5
 * audio support would use the Flash Plugin.
 *
 * Note that there is not currently a supported WebAudio plugin.
 *
 * @module SoundJS
 */

(function() {

	//TODO: Interface to validate plugins and throw warnings
	//TODO: Determine if methods exist on a plugin before calling
	//TODO: Interface to validate instances and throw warnings
	//TODO: Surface errors on audio from all plugins

	//TODO: Timeouts
	//TODO: Put Plugins on SoundJS.lib?

	/**
	 * The public API for creating sounds, and controlling the overall sound levels,
	 * and affecting multiple sounds at once. All SoundJS APIs are static.
	 *
	 * SoundJS can also be used as a PreloadJS plugin to help preload audio properly.
	 * @class SoundJS
	 * @constructor
	 */
	function SoundJS() {
		throw "SoundJS cannot be instantiated";
	}

	var s = SoundJS;

	/**
	 * Determine how audio is split, when multiple paths are specified in a source.
	 * @property DELIMITER
	 * @type String
	 * @default |
	 * @static
	 */
	s.DELIMITER = "|";

	/**
	 * The duration in milliseconds to determine a timeout.
	 * @property AUDIO_TIMEOUT
	 * @static
	 * @type Number
	 * @default 8000
	 */
	s.AUDIO_TIMEOUT = 8000; //TODO: Not fully implemented

	/**
	 * The interrupt value to use to interrupt any currently playing instance with the same source.
	 * @property INTERRUPT_ANY
	 * @type String
	 * @default any
	 * @static
	 */
	s.INTERRUPT_ANY = "any";

	/**
	 * The interrupt value to use to interrupt the earliest currently playing instance with the same source.
	 * @property INTERRUPT_EARLY
	 * @type String
	 * @default early
	 * @static
	 */
	s.INTERRUPT_EARLY = "early";

	/**
	 * The interrupt value to use to interrupt the latest currently playing instance with the same source.
	 * @property INTERRUPT_LATE
	 * @type String
	 * @default late
	 * @static
	 */
	s.INTERRUPT_LATE = "late";

	/**
	 * The interrupt value to use to interrupt no currently playing instances with the same source.
	 * @property INTERRUPT_NONE
	 * @type String
	 * @default none
	 * @static
	 */
	s.INTERRUPT_NONE = "none";

	// Important, implement playState in plugins with these values.

	/**
	 * Defines the playState of an instance that is still initializing.
	 * @property PLAY_INITED
	 * @type String
	 * @default playInited
	 * @static
	 */
	s.PLAY_INITED = "playInited";

	/**
	 * Defines the playState of an instance that is currently playing or paused.
	 * @property PLAY_SUCCEEDED
	 * @type String
	 * @default playSucceeded
	 * @static
	 */
	s.PLAY_SUCCEEDED = "playSucceeded";

	/**
	 * Defines the playState of an instance that was interrupted by another instance.
	 * @property PLAY_INTERRUPTED
	 * @type String
	 * @default playInterrupted
	 * @static
	 */
	s.PLAY_INTERRUPTED = "playInterrupted";

	/**
	 * Defines the playState of an instance that completed playback.
	 * @property PLAY_FINISHED
	 * @type String
	 * @default playFinished
	 * @static
	 */
	s.PLAY_FINISHED = "playFinished";

	/**
	 * Defines the playState of an instance that failed to play. This is usually caused by a lack of available channels
	 * when the interrupt mode was "INTERRUPT_NONE", the playback stalled, or the sound could not be found.
	 * @property PLAY_FAILED
	 * @type String
	 * @default playFailed
	 * @static
	 */
	s.PLAY_FAILED = "playFailed";

	/**
	 * The currently active plugin. If this is null, then no plugin could be initialized.
	 * If no plugin was specified, only the HTMLAudioPlugin is tested.
	 * @property activePlugin
	 * @type Object
	 * @default null
	 * @static
	 */
	s.activePlugin = null;

	/**
	 * SoundJS is currently muted. No audio will play, unless existing instances are unmuted. This property
	 * is read-only.
	 * @property muted
	 * @type {Boolean}
	 * @default false
	 */
	s.muted = false;


// Private
	s.pluginsRegistered = false;
	s.masterVolume = 1;
	s.instances = [];
	s.instanceHash = {};
	s.idHash = null;
	s.defaultSoundInstance = null;

	/**
	 * Get the preload rules to be used by PreloadJS. This function should not be called, except by PreloadJS.
	 * @method getPreloadHandlers
	 * @return {Object} The callback, file types, and file extensions to use for preloading.
	 * @static
	 * @private
	 */
	s.getPreloadHandlers = function() {
		return {
			callback: s.proxy(s.initLoad, s),
			types: ["sound"],
			extensions: ["mp3", "m4a", "ogg", "wav"]
		}
	}

	/**
	 * Register a list of plugins, in order of precedence.
	 * @method registerPlugins
	 * @param {Array} plugins An array of plugins to install.
	 * @return {Boolean} Whether a plugin was successfully initialized.
	 * @static
	 */
	s.registerPlugins = function(plugins) {
		s.pluginsRegistered = true;
		for (var i=0, l=plugins.length; i<l; i++) {
			var plugin = plugins[i];
			if (plugin == null) { continue; } // In case a plugin is not defined.
			// Note: Each plugin is passed in as a class reference, but we store the activePlugin as an instances
			if (plugin.isSupported()) {
				s.activePlugin = new plugin();
				//TODO: Check error on initialization?
				return true;
			}
		}
		return false;
	}

	/**
	 * Register a SoundJS plugin. Plugins handle the actual playing
	 * of audio. By default the HTMLAudio plugin will be installed if
	 * no other plugins are present when the user starts playback.
	 * @method registerPlugin
	 * @param {Object} plugin The plugin class to install.
	 * @return {Boolean} Whether the plugin was successfully initialized.
	 * @static
	 */
	s.registerPlugin = function(plugin) {
		s.pluginsRegistered = true;
		if (plugin == null) { return false; }
		if (plugin.isSupported()) {
			s.activePlugin = new plugin();
			return true;
		}
		return false;
	}

	/**
	 * Determines if SoundJS has been initialized, and a plugin has been activated.
	 * @method isReady
	 * @return {Boolean} If SoundJS has initialized a plugin.
	 * @static
	 */
	s.isReady = function() {
		return (s.activePlugin != null);
	}

	/**
	 * Get the active plugin's capabilities, which help determine if a plugin can be
	 * used in the current environment, or if the plugin supports a specific feature.
	 * Capabilities include:
	 * <ul>
	 *     <li><b>panning:</b> If the plugin can pan audio from left to right</li>
	 *     <li><b>volume;</b> If the plugin can control audio volume.</li>
	 *     <li><b>mp3:</b> If MP3 audio is supported.</li>
	 *     <li><b>ogg:</b> If OGG audio is supported.</li>
	 *     <li><b>wav:</b> If WAV audio is supported.</li>
	 *     <li><b>mpeg:</b> If MPEG audio is supported.</li>
	 *     <li><b>channels:</b> The maximum number of audio channels that can be created.</li>
	 * @method getCapabilities
	 * @return {Object} An object containing the capabilities of the active plugin.
	 * @static
	 */
	s.getCapabilities = function() {
		if (s.activePlugin == null) { return null; }
		return s.activePlugin.capabilities;
	}

	/**
	 * Get a specific capability of the active plugin. See the <b>getCapabilities</b> for a full list
	 * of capabilities.
	 * @method getCapability
	 * @param {String} key The capability to retrieve
	 * @return {String | Number | Boolean} The capability value.
	 * @static
	 */
	s.getCapability = function(key) {
		if (s.activePlugin == null) { return null; }
		return s.activePlugin.capabilities[key];
	}

	/**
	 * Process manifest items from PreloadJS.
	 * @method initLoad
	 * @param {String | Object} value The src or object to load
	 * @param {String} type The optional type of object. Will likely be "sound".
	 * @param {String} id An optional id
	 * @param {Number | String | Boolean | Object} data Optional data associated with the item
	 * @return {Object} An object with the modified values that were passed in.
	 * @private
	 */
	s.initLoad = function(src, type, id, data) {
		if (!s.checkPlugin(true)) { return false; }

		var details = s.parsePath(src, type, id, data);
		if (details == null) { return false; }

		if (id != null) {
			if (s.idHash == null) { s.idHash = {}; }
			s.idHash[id] = details.src;
		}

		var ok = SoundChannel.create(details.src, data);
		var instance = s.activePlugin.register(details.src, data);
		if (instance != null) {
			// If the instance returns a tag, return it instead for preloading.
			if (instance.tag != null) { details.tag = instance.tag; }
			else if (instance.src) { details.src = instance.src; }
			// If the instance returns a complete handler, pass it on to the prelaoder.
			if (instance.completeHandler != null) { details.handler = instance.completeHandler; }
		}
		return details;
	}

	/**
	 * Parse the path of a manifest item
	 * @method parsePath
	 * @param {String | Object} value
	 * @param {String} type
	 * @param {String} id
	 * @param {Number | String | Boolean | Object} data
	 * @return {Object} A formatted object to load.
	 * @private
	 */
	s.parsePath = function(value, type, id, data) {
		// Assume value is string.
		var sounds = value.split(s.DELIMITER);
		var ret = {type:type||"sound", id:id, data:data, handler:s.handleSoundReady};
		var found = false;
		var c = s.getCapabilities();
		for (var i=0, l=sounds.length; i<l; i++) {
			var sound = sounds[i];
			var point = sound.lastIndexOf(".");
			var ext = sound.substr(point+1).toLowerCase();
			var name = sound.substr(0, point).split("/").pop();
			switch (ext) {
				case "mp3":
					if (c.mp3) { found = true; }
					break;
				case "m4a":
					if (c.mp4) { found = true; }
					break;
				case "ogg":
					if (c.ogg) { found = true; }
					break;
				case "wav":
					if (c.wav) { found = true; }
					break;
				// TODO: Other cases.
			}

			if (found) {
				ret.name = name;
				ret.src = sound;
				ret.extension = ext;
				return ret;
			}
		}
		return null;
	}


	/* ---------------
	 Static API.
	--------------- */
	/**
	 * Play a sound, receive an instance to control. If the sound failed to play, the soundInstance
	 * will still be returned, and have a playState of SoundJS.PLAY_FAILED. Note that even on sounds with
	 * failed playback, you may still be able to call play(), since the failure could be due to lack of available
	 * channels.
	 * @method play
	 * @param {String} value The src or ID of the audio.
	 * @param {String} interrupt How to interrupt other instances of audio. Values are defined as constants on SoundJS.
	 * @param {Number} delay The amount of time to delay the start of the audio. Delay is in milliseconds.
	 * @param {Number} offset The point to start the audio. Offset is in milliseconds.
	 * @param {Number} loop Determines how many times the audio loops when it reaches the end of a sound. Default is 0 (no loops). Set to -1 for infinite.
	 * @param {Number} volume The volume of the sound, between 0 and 1
	 * @param {Number} pan The left-right pan of the sound (if supported), between -1 (left) and 1 (right)
	 * @return {SoundInstance} A SoundInstance that can be controlled after it is created.
	 * @static
	 */
	s.play = function (src, interrupt, delay, offset, loop, volume, pan) {
		if (!s.checkPlugin(true)) { return s.defaultSoundInstance; }
		src = s.getSrcFromId(src);
		var instance = s.activePlugin.create(src);
		try { instance.mute(s.muted); } catch(error) { } // Sometimes, plugin isn't ready!
		var ok = s.playInstance(instance, interrupt, delay, offset, loop, volume, pan);
		if (!ok) { instance.playFailed(); }
		return instance;
	}

	/**
	 * Play an instance. This is called by the static API, as well as from plugins. This allows the
	 * core class to control delays.
	 * @method playInstance
	 * @return {Boolean} If the sound can start playing.
	 * @protected
	 */
	s.playInstance = function(instance, interrupt, delay, offset, loop, volume, pan) {
		interrupt = interrupt || s.INTERRUPT_NONE;
		if (delay == null) { delay = 0; }
		if (offset == null) { offset = 0; }
		if (loop == null) { loop = 0; }
		if (volume == null) { volume = 1; }
		if (pan == null) { pan = 0; }

		if (delay == 0) {
			var ok = s.beginPlaying(instance, interrupt, offset, loop, volume, pan);
			if (!ok) { return false; }
		} else {
			//Note that we can't pass arguments to proxy OR setTimeout (IE), so just wrap the function call.
			setTimeout(function() {
					s.beginPlaying(instance, interrupt, offset, loop, volume, pan);
				}, delay); //LM: Can not stop before timeout elapses. Maybe add timeout interval to instance?
		}

		this.instances.push(instance);
		this.instanceHash[instance.uniqueId] = instance;

		return true;
	}

	/**
	 * Begin playback. This is called immediately, or after delay by SoundJS.beginPlaying
	 * @method beginPlaying
	 * @protected
	 */
	s.beginPlaying = function(instance, interrupt, offset, loop, volume, pan) {
		if (!SoundChannel.add(instance, interrupt)) { return false; }
		var result = instance.beginPlaying(offset, loop, volume, pan);
		if (!result) {
			var index = this.instances.indexOf(instance);
			if (index > -1) {
				this.instances.splice(index, 1);
			}
			delete this.instanceHash[instance.uniqueId];
			return false;
		}
		return true;
	}

	/**
	 * Determine if a plugin has been initialized. Optionally initialize the default plugin, which enables
	 * SoundJS to work without manually setting up the plugins.
	 * @method checkPlugin
	 * @param {Boolean} initializeDefault Determines if the default plugin should be initialized if there
	 * is not yet a plugin when this is checked.
	 * @returns If a plugin is initialized. If the browser does not have the capabilities to initialize
	 * an available plugin, this will be false.
	 */
	s.checkPlugin = function(initializeDefault) {
		if (s.activePlugin == null) {
			if (initializeDefault && !s.pluginsRegistered) {
				s.registerPlugin(createjs.HTMLAudioPlugin);
			}
			if (s.activePlugin == null) {
				return false;
			}
		}
		return true;
	}

	/**
	 * Get the source of a sound via the ID passed in with the manifest. If no ID is found
	 * the value is passed back.
	 * @method getSrcFromId
	 * @param value The name or src of a sound.
	 * @return {String} The source of the sound.
	 * @static
	 */
	s.getSrcFromId = function(value) {
		if (s.idHash == null || s.idHash[value] == null) { return value; }
		return s.idHash[value];
	}


/* ---------------
 Global controls
--------------- */
	/**
	 * Set the volume of all sounds. This sets the volume value of all audio, and
	 * is not a "master volume". Use setMasterVolume() instead.
	 * @method setVolume
	 * @param {Number} The volume to set on all sounds. The acceptable range is 0-1.
	 * @param {String} id Optional, the specific sound ID to target.
	 * @return {Boolean} If the volume was set.
	 * @static
	 */
	s.setVolume = function(value, id) {
		// don't deal with null volume
		if (Number(value) == null) { return false; }
		value = Math.max(0, Math.min(1, value));

		return s.tellAllInstances("setVolume", id, value);
		/*SoundJS.activePlugin.setVolume(value, SoundJS.getSrcFromId(id));*/
		//return true;
	}

	/**
	 * Get the master volume. All sounds multiply their current volume against the master volume.
	 * @method getMasterVolume
	 * @return {Number} The master volume
	 * @static
	 */
	s.getMasterVolume = function() { return s.masterVolume; }
	/**
	 * To set the volume of all instances at once, use the setVolume() method.
	 * @method setMasterVolume
	 * @param {Number} value The master volume to set.
	 * @return {Boolean} If the master volume was set.
	 * @static
	 */
	s.setMasterVolume = function(value) {
		s.masterVolume = value;
		return s.tellAllInstances("setMasterVolume", null, value);
	}

	/**
	 * Mute/Unmute all audio. Note that muted audio still plays at 0 volume,
	 * and that individually muted audio will be affected by setting the global mute.
	 * @method setMute
	 * @param {Boolean} isMuted Whether the audio should be muted or not.
	 * @param {String} id The specific sound ID (set) to target.
	 * @return {Boolean} If the mute was set.
	 * @static
	 */
	s.setMute = function(isMuted) {
		this.muted = isMuted;
		return s.tellAllInstances("mute", null, isMuted);
	}

	/**
	 * Pause all instances.
	 * @method pause
	 * @param id The specific sound ID (set) to target.
	 * @return If the audio was paused or not.
	 * @static
	 */
	s.pause = function(id) {
		return s.tellAllInstances("pause", id);
	}

	/**
	 * Resume all instances. Note that the pause/resume methods do not work independantly
	 * of each instance's paused state. If one instance is already paused when the SoundJS.pause
	 * method is called, then it will resume when this method is called.
	 * @method resume
	 * @param id The specific sound ID (set) to target.
	 * @return If the audio was resumed or not
	 * @static
	 */
	s.resume = function(id) {
		return s.tellAllInstances("resume", id);
	}

	/**
	 * Stop all audio (Global stop).
	 * @method stop
	 * @param id The specific sound ID (set) to target.
	 * @return If the audio was stopped or not.
	 * @static
	 */
	s.stop = function(id) {
		return s.tellAllInstances("stop", id);
	}

	/**
	 * Get a SoundInstance by a unique id. It is often useful to store audio
	 * instances by id (in form elements for example), so this method provides
	 * a useful way to access the instances via their IDs.
	 * @method getInstanceById
	 * @param uniqueId The id to use as lookup.
	 * @return {SoundInstance} The sound instance with the specified ID.
	 * @static
	 */
	s.getInstanceById = function(uniqueId) {
		return this.instanceHash[uniqueId];
	}

	/**
	 * A sound has completed playback, been interrupted, failed, or been stopped.
	 * Remove instance management. It will be added again, if the sound re-plays.
	 * Note that this method is called from the instances.
	 * @method playFinished
	 * @param {SoundInstance} instance The instance that finished playback.
	 * @private
	 */
	s.playFinished = function(instance) {
		SoundChannel.remove(instance);
		var index = this.instances.indexOf(instance);
		if (index > -1) {
			this.instances.splice(index, 1);
		}
		// Note: Keep in instance hash.
	}

	/**
	 * Call a method on all instances. Passing an optional ID will filter the event
	 * to only sounds matching that id (or source).
	 * @method tellAllInstances
	 * @param {String} command The command to call on each instance.
	 * @param {String} id A specific sound ID to call. If omitted, the command will be applied
	 *      to all sound instances.
	 * @param {Object} value A value to pass on to each sound instance the command is applied to.
	 * @private
	 */
	s.tellAllInstances = function(command, id, value) {
		if (this.activePlugin == null) { return false; }
		var src = this.getSrcFromId(id);
		for (var i=this.instances.length-1; i>=0; i--) {
			var instance = this.instances[i];
			if (src != null && instance.src != src) { continue; }
			switch (command) {
				case "pause":
					instance.pause(); break;
				case "resume":
					instance.resume(); break;
				case "setVolume":
					instance.setVolume(value); break;
				case "setMasterVolume":
					instance.setMasterVolume(value); break;
				case "mute":
					instance.mute(value); break;
				case "stop":
					instance.stop(); break;
				case "setPan":
					instance.setPan(value); break;
			}
		}
		return true;
	}

	/**
	 * A function proxy for SoundJS methods. By default, JavaScript methods do not maintain scope, so passing a
	 * method as a callback will result in the method getting called in the scope of the caller. Using a proxy
	 * ensures that the method gets called in the correct scope. All internal callbacks in SoundJS use this approach.
	 * @method proxy
	 * @param {Function} method The function to call
	 * @param {Object} scope The scope to call the method name on
	 * @static
	 * @private
	 */
	s.proxy = function(method, scope) {
		return function() {
			return method.apply(scope, arguments);
		}
	}

	createjs.SoundJS = SoundJS;



	/**
	 * SoundChannel manages the number of active instances
	 * @class SoundChannel
	 * @param src The source of the instances
	 * @param max The number of instances allowed
	 * @private
	 */
	function SoundChannel(src, max) {
		this.init(src, max);
	}

/* ------------
   Static API
------------ */
	/**
	 * A hash of channel instances by src.
	 * @property channels
	 * @static
	 * @private
	 */
	SoundChannel.channels = {};
	/**
	 * Create a sound channel.
	 * @method create
	 * @static
	 * @param {String} src The source for the channel
	 * @param {Number} max The maximum amount this channel holds.
	 * @private
	 */
	SoundChannel.create = function(src, max) {
		var channel = SoundChannel.get(src);
		if (channel == null) {
			SoundChannel.channels[src] = new SoundChannel(src, max);
		} else {
			channel.max += max;
		}
	}
	/**
	 * Add an instance to a sound channel.
	 * method add
	 * @param {SoundInstance} instance The instance to add to the channel
	 * @param {String} interrupt The interrupt value to use
	 * @static
	 * @private
	 */
	SoundChannel.add = function(instance, interrupt) {
		var channel = SoundChannel.get(instance.src);
		if (channel == null) { return false; }
		return channel.add(instance, interrupt);
	}
	/**
	 * Remove an instace from its channel.
	 * method remove
	 * @param {SoundInstance} instance The instance to remove from the channel
	 * @static
	 * @private
	 */
	SoundChannel.remove = function(instance) {
		var channel = SoundChannel.get(instance.src);
		if (channel == null) { return false; }
		channel.remove(instance);
		return true;
	}
	/**
	 * Get a channel instance by its src.
	 * method get
	 * @param {String} src The src to use to look up the channel
	 * @static
	 * @private
	 */
	SoundChannel.get = function(src) {
		return SoundChannel.channels[src];
	}

	var p = SoundChannel.prototype = {

		/**
		 * The src of the channel
		 * @property src
		 * @private
		 */
		src: null,

		/**
		 * The maximum number of instances in this channel
		 * @property max
		 * @private
		 */
		max: null,
		/**
		 * The current number of active instances.
		 * @property length
		 * @private
		 */
		length: 0,

		/**
		 * Initialize the channel
		 * @method init
		 * @param {String} src The source of the channel
		 * @param {Number} max The maximum number of instances in the channel
		 * @private
		 */
		init: function(src, max) {
			this.src = src;
			this.max = max || 1;
			this.instances = [];
		},

		/**
		 * Get an instance by index
		 * @method get
		 * @param {Number} index The index to return.
		 * @private
		 */
		get: function(index) {
			return this.instances[index];
		},

		/**
		 * Add a new instance
		 * @method add
		 * @param {SoundInstance} instance The instance to add.
		 * @private
		 */
		add: function(instance, interrupt) {
			if (!this.getSlot(interrupt, instance)) {
				return false;
			};
			this.instances.push(instance);
			this.length++;
			return true;
		},

		/**
		 * Remove an instance
		 * @method remove
		 * @param {SoundInstance} instance The instance to remove
		 * @private
		 */
		remove: function(instance) {
			var index = this.instances.indexOf(instance);
			if (index == -1) { return false; }
			this.instances.splice(index, 1);
			this.length--;
			return true;
		},

		/**
		 * Get an available slot
		 * @method getSlot
		 * @param {String} interrupt The interrupt value to use.
		 * @param {SoundInstance} instance The sound instance the will go in the channel if successful.
		 * @private
		 */
		getSlot: function(interrupt, instance) {
			var target, replacement;

			var margin = SoundJS.activePlugin.FT || 0;

			for (var i=0, l=this.max||100; i<l; i++) {
				target = this.get(i);

				// Available Space
				if (target == null) {
					return true;
				} else if (interrupt == SoundJS.INTERRUPT_NONE) {
					continue;
				}

				// First replacement candidate
				if (i == 0) {
					replacement = target;
					continue;
				}

				// Audio is complete or not playing
				if (target.playState == SoundJS.PLAY_FINISHED ||
						target == SoundJS.PLAY_INTERRUPTED ||
						target == SoundJS.PLAY_FAILED) {
					replacement = target;

				// Audio is a better candidate than the current target, according to playhead
				} else if (
						(interrupt == SoundJS.INTERRUPT_EARLY && target.getPosition() < replacement.getPosition()) ||
						(interrupt == SoundJS.INTERRUPT_LATE && target.getPosition() > replacement.getPosition())) {
					replacement = target;
				}
			}

			if (replacement != null) {
				replacement.interrupt();
				this.remove(replacement);
				return true;
			}
			return false;
		},

		toString: function() {
			return "[SoundJS SoundChannel]";
		}

	}

	// do not add to namespace

	// This is a dummy sound instance, which allows SoundJS to return something so
	// developers don't need to check nulls.
	function SoundInstance() {
		this.isDefault = true;
		this.pause = this.resume = this.play = this.beginPlaying = this.cleanUp = this.interrupt = this.stop = this.setMasterVolume = this.setVolume = this.mute = this.setPan = this.getPosition = this.setPosition = this.playFailed = function() { return false; };
		this.getVolume = this.getPan = this.getDuration = function() { return 0; }
		this.playState = SoundJS.PLAY_FAILED;
		this.toString = function() { return "[SoundJS Default Sound Instance]"; }
	}
	SoundJS.defaultSoundInstance = new SoundInstance();


	// An additional module to determine the current browser, version, operating system, and other environment variables.
	function BrowserDetect() {}

	BrowserDetect.init = function() {
		var agent = navigator.userAgent;
		BrowserDetect.isFirefox = (agent.indexOf("Firefox")> -1);
		BrowserDetect.isOpera = (window.opera != null);
		BrowserDetect.isIOS = agent.indexOf("iPod") > -1 || agent.indexOf("iPhone") > -1 || agent.indexOf("iPad") > -1;
	}

	BrowserDetect.init();

	createjs.SoundJS.BrowserDetect = BrowserDetect;

}());

/*--------------------------------------------------
 *   Main - ../src/js/main.js
 */
/**
# Main.js
Main.js handles loading the game assets and creates the game object. Main.js is called on the window 'load' event. Main takes advantage of [PreloadJS][link1] to handle the loading process.
[link1]: http://createjs.com/Docs/PreloadJS/PreloadJS.html
*/

// Clean up console logging for MSIE
(function(window){
	if(window && !window.console){
		var console = window.console = {};
		console.log = console.warn = console.error = function(){};
	}
})(window);

window.addEventListener('load', function(){
	var checkPush = function(asset, list){
		var i = 0,
		found = false;
		for(i in list){
			if(list[i].id === asset.id){
				found = true;
				break;
			}
		}
		if(!found){
			list.push(asset);
		}
	},
	loader     = new createjs.PreloadJS(),
	loadAssets = [],
	optimizeImages = platformer.settings.global.nativeAssetResolution || 0, //assets designed for this resolution
//	scale = platformer.settings.scale = optimizeImages?Math.min(1, Math.max(window.screen.width, window.screen.height) * window.devicePixelRatio / optimizeImages):1,
	scale = platformer.settings.scale = optimizeImages?Math.min(1, Math.max(window.innerWidth, window.innerHeight) * window.devicePixelRatio / optimizeImages):1,
	scaleImage = function(img, columns, rows){
		var r          = rows    || 1,
		c              = columns || 1,
		imgWidth       = Math.ceil((img.width  / c) * scale) * c,
		imgHeight      = Math.ceil((img.height / r) * scale) * r,
		element        = document.createElement('canvas'),
		ctx            = element.getContext('2d');
		element.width  = imgWidth;
		element.height = imgHeight;
		element.scaleX = imgWidth  / img.width;
		element.scaleY = imgHeight / img.height;
		ctx.drawImage(img, 0, 0, img.width, img.height, 0, 0, imgWidth, imgHeight);
		return element;
	};
	
	loader.onProgress = function (event) {
		console.log('Progress:', event);	
	};
	
	loader.onFileLoad = function (event) {
		var data = event.data,
		result   = event.result;
		
		console.log('Load:', event);
		
		if(event.type == "image"){
			if(optimizeImages && (scale !== 1) && (event.type == "image")){
				if(data){
					result = scaleImage(result, data.columns, data.rows);
				} else {
					result = scaleImage(result);
				}
			}
		}
		
		platformer.assets[event.id] = result;
	};
	
	loader.onError = function (event) {
		console.log('Your stuff broke!');
	};
	
	loader.onComplete = function (event) {
		platformer.game = new platformer.classes.game(platformer.settings);
		createjs.Ticker.useRAF = true;
		createjs.Ticker.setFPS(platformer.settings.global.fps);
		createjs.Ticker.addListener(platformer.game);
	};
	
	for(var i in platformer.settings.assets){
		if(typeof platformer.settings.assets[i].src === 'string'){
			checkPush(platformer.settings.assets[i], loadAssets);
		} else {
			for(var j in platformer.settings.assets[i].src){
				if(platformer.settings.aspects[j] && platformer.settings.assets[i].src[j]){
					if(typeof platformer.settings.assets[i].src[j] === 'string'){
						platformer.settings.assets[i].src  = platformer.settings.assets[i].src[j];
						checkPush(platformer.settings.assets[i], loadAssets);
					} else {
						platformer.settings.assets[i].data    = platformer.settings.assets[i].src[j].data || platformer.settings.assets[i].data;
						platformer.settings.assets[i].assetId = platformer.settings.assets[i].src[j].assetId;
						platformer.settings.assets[i].src     = platformer.settings.assets[i].src[j].src;
						checkPush({
							id:  platformer.settings.assets[i].assetId || platformer.settings.assets[i].id,
							src: platformer.settings.assets[i].src
						}, loadAssets);
					}
					break;
				}
			}
			if(typeof platformer.settings.assets[i].src !== 'string'){
				if(platformer.settings.assets[i].src['default']){
					if(typeof platformer.settings.assets[i].src['default'] === 'string'){
						platformer.settings.assets[i].src  = platformer.settings.assets[i].src['default'];
						checkPush(platformer.settings.assets[i], loadAssets);
					} else {
						platformer.settings.assets[i].data    = platformer.settings.assets[i].src['default'].data || platformer.settings.assets[i].data;
						platformer.settings.assets[i].assetId = platformer.settings.assets[i].src['default'].assetId;
						platformer.settings.assets[i].src     = platformer.settings.assets[i].src['default'].src;
						checkPush({
							id:  platformer.settings.assets[i].assetId || platformer.settings.assets[i].id,
							src: platformer.settings.assets[i].src
						}, loadAssets);
					}
				} else {
					console.warn('Asset has no valid source for this browser.', platformer.settings.assets[i]);
				}
			}
		}
	}
	if(platformer.settings.supports.android){ //Android thinks HTMLAudioPlugin works, so we avoid that misconception here
		createjs.SoundJS.registerPlugin(createjs.HTMLiOSAudioPlugin);
	} else {
		createjs.SoundJS.registerPlugins([createjs.HTMLAudioPlugin, createjs.HTMLiOSAudioPlugin]);
	}
	loader.installPlugin(createjs.SoundJS);
	loader.loadManifest(loadAssets);
	platformer.assets = [];

}, false);
})();