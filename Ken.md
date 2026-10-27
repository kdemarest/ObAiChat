
Read gptchat/AGENTS.md and included files first. 

## JS File Pattern

Critical: All .JS files must use the pattern:

Module.add('thisFilesName',function()
{
return {
	ExternName: TheClassOrFunctionName,
	etc
}

});

window.Module = new class {
	constructor() {
		this.list = {};
		this.count = 10;
	}
	add(id,fn) {
		if( typeof id === 'function' ) {
			fn = id;
			id = this.count++;
		}
		this.list[id] = {
			moduleId: id,
			hasRun: false,
			initFn: fn,
			globals: {}
		}
	}
	realize() {
		for( let moduleId in this.list ) {
			let mod = this.list[moduleId];
			if( mod.hasRun ) {
				continue;
			}

			let windowVars = {};
			for( let key in window ) {
				windowVars[key] = true;
			}

			//console.log('Initializing '+id);
			let globals = this.list[mod.moduleId].initFn(window,mod.moduleId);
			mod.hasRun = true;
			for( let varId in globals ) {
				// console.log('Importing '+varId);
				window[varId] = globals[varId];
			}
			mod.globals = globals;
			for( let i in this ) {
				if( i!=='list' && i!=='count' ) {
					alert('Rogue declaration in module '+moduleId+' is '+i);
					console.log("Rogue declaration "+i);
					delete this[i]
				}
			}
			for( let key in window ) {
				if( !windowVars[key] && !globals[key] ) {
					throw 'Error: rogue declaration in scope window in module '+moduleId+' is '+key;
				}
			}
		}
	}
	entryPoint(fn) {
		document.addEventListener("DOMContentLoaded", () => {
			this.realize();
			fn();
		});
	}
};

window.Module.entryPoint(()=>{});


