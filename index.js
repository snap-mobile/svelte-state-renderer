const merge = require(`deepmerge`)

function instantiateWithMethods(Component, options, methods) {
	// const coolPrototype = Object.assign(Object.create(Component.prototype), methods)
	// return Component.call(coolPrototype, options)
	return Object.assign(new Component(options), methods)
}

module.exports = function SvelteStateRendererFactory(defaultOptions = {}) {
	return function makeRenderer(stateRouter) {
		const asr = {
			makePath: stateRouter.makePath,
			stateIsActive: stateRouter.stateIsActive,
		}

		function render(context, cb) {
			const { element: target, template, content } = context

			const rendererSuppliedOptions = merge(defaultOptions, {
				target,
				props: Object.assign(content, defaultOptions.props, { asr }),
				data: Object.assign(content, defaultOptions.props, { asr }),
			})

			function construct(component, options) {
				return options.methods
					? instantiateWithMethods(component, options, options.methods)
					: new component(options)
			}

			let svelte

			try {
				if (typeof template === `function`) {
					svelte = construct(template, rendererSuppliedOptions)
				} else {
					const options = merge(rendererSuppliedOptions, template.options)

					svelte = construct(template.component, options)
				}
			} catch (e) {
				cb(e)
				return
			}

			function onRouteChange() {
				if (typeof svelte.$set === 'function') {
					svelte.$set({
						asr,
					})
				} else {
					svelte.set({
						asr,
					})
				}
			}

			stateRouter.on(`stateChangeEnd`, onRouteChange)

			svelte.asrOnDestroy = () => stateRouter.removeListener(`stateChangeEnd`, onRouteChange)
			svelte.mountedToTarget = target

			cb(null, svelte)
		}

		return {
			render,
			reset: function reset(context, cb) {
				const svelte = context.domApi
				const element = svelte.mountedToTarget

				svelte.asrOnDestroy()
				if (typeof svelte.$destroy === 'function') {
					svelte.$destroy()
				} else {
					svelte.teardown()
				}

				const renderContext = Object.assign({ element }, context)

				render(renderContext, cb)
			},
			destroy: function destroy(svelte, cb) {
				svelte.asrOnDestroy()
				if (typeof svelte.$destroy === 'function') {
					svelte.$destroy()
				} else {
					svelte.teardown()
				}
				cb()
			},
			getChildElement: function getChildElement(svelte, cb) {
				try {
					const element = svelte.mountedToTarget
					const child = element.querySelector(`uiView`)
					cb(null, child)
				} catch (e) {
					cb(e)
				}
			},
		}
	}
}
