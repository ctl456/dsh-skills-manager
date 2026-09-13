window.__ModuleLoader__.load({
	id: "@ctl456/dsh-skills-manager",
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;
		Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
		let _deepseek_ai_dsh_client_ui_primitives = require("@deepseek-ai/dsh-client-ui-primitives");
		let react_jsx_runtime = require("react/jsx-runtime");
		let _deepseek_ai_dsh_client_store = require("@deepseek-ai/dsh-client-store");
		//#region \0dsh-css:/home/ctl456/Code_Project/deepseek-harness/packages/skill/skills-manager/src/client/SkillsManagerCard.module.css.mjs
		const css = ".LxiGPq_page{flex-direction:column;gap:14px;display:flex}.LxiGPq_header{flex-direction:column;gap:2px;display:flex}.LxiGPq_title{margin:0;font-size:16px;font-weight:600}.LxiGPq_description{color:var(--dsw-alias-label-secondary);font-size:12px}.LxiGPq_notice{color:var(--dsw-alias-label-secondary);margin:0;font-size:12px}.LxiGPq_toolbar{align-items:center;gap:8px;display:flex}.LxiGPq_searchWrap{flex:1;align-items:center;min-width:0;display:flex;position:relative}.LxiGPq_searchIcon{color:var(--dsw-alias-label-secondary);pointer-events:none;display:inline-flex;position:absolute;left:9px}.LxiGPq_search{box-sizing:border-box;width:100%;font:inherit;border:1px solid var(--dsw-alias-border-l1);background:var(--dsw-alias-bg-base);color:inherit;border-radius:6px;padding:6px 8px 6px 30px;font-size:13px}.LxiGPq_list{flex-direction:column;gap:8px;margin:0;padding:0;list-style:none;display:flex}.LxiGPq_item{border:1px solid var(--dsw-alias-border-l1);border-radius:8px;justify-content:space-between;align-items:center;gap:12px;padding:8px 10px;display:flex}.LxiGPq_itemText{flex-direction:column;min-width:0;display:flex}.LxiGPq_itemName{font-size:13px;font-weight:600}.LxiGPq_itemMeta{color:var(--dsw-alias-label-secondary);text-overflow:ellipsis;white-space:nowrap;font-size:12px;overflow:hidden}.LxiGPq_itemActions{flex-shrink:0;align-items:center;gap:6px;display:flex}.LxiGPq_badgeOn,.LxiGPq_badgeOff{border:1px solid;border-radius:999px;padding:1px 8px;font-size:11px}.LxiGPq_badgeOn{color:var(--dsw-alias-state-success-primary)}.LxiGPq_badgeOff{color:var(--dsw-alias-label-secondary)}.LxiGPq_problem{color:var(--dsw-alias-state-error-primary);margin:0;font-size:11px}.LxiGPq_empty{color:var(--dsw-alias-label-secondary);margin:0;font-size:12px}.LxiGPq_pager{justify-content:flex-end;align-items:center;gap:8px;display:flex}.LxiGPq_pageInfo{color:var(--dsw-alias-label-secondary);font-size:12px}.LxiGPq_dialogContent{max-height:68vh;overflow-y:auto}.LxiGPq_field{flex-direction:column;gap:4px;display:flex}.LxiGPq_label{font-size:12px;font-weight:600}.LxiGPq_input,.LxiGPq_textarea{box-sizing:border-box;width:100%;font:inherit;border:1px solid var(--dsw-alias-border-l1);background:var(--dsw-alias-bg-base);color:inherit;resize:vertical;border-radius:6px;padding:6px 8px;font-size:13px}.LxiGPq_hint{color:var(--dsw-alias-label-secondary);white-space:pre-line;font-size:11px}.LxiGPq_toggle{align-items:flex-start;gap:8px;display:flex}.LxiGPq_toggleText{flex-direction:column;gap:2px;display:flex}.LxiGPq_error{color:var(--dsw-alias-state-error-primary);margin:0;font-size:12px}.LxiGPq_actions{gap:8px;display:flex}.LxiGPq_button,.LxiGPq_primary,.LxiGPq_danger{font:inherit;border:1px solid var(--dsw-alias-border-l1);color:inherit;cursor:pointer;background:0 0;border-radius:6px;align-items:center;gap:4px;padding:5px 12px;font-size:12px;display:inline-flex}.LxiGPq_primary{background:var(--dsw-alias-button-primary-fill);color:var(--dsw-alias-label-primary-foreground);border-color:#0000}.LxiGPq_primary:hover:not(:disabled){background:var(--dsw-alias-button-primary-hover)}.LxiGPq_danger{color:var(--dsw-alias-state-error-primary)}.LxiGPq_button:disabled,.LxiGPq_primary:disabled,.LxiGPq_danger:disabled{opacity:.5;cursor:not-allowed}.LxiGPq_row{gap:10px;display:flex}.LxiGPq_row>*{flex:1;min-width:0}.LxiGPq_fileRow{align-items:center;gap:8px;display:flex}.LxiGPq_fileName{color:var(--dsw-alias-label-secondary);overflow-wrap:anywhere;font-size:12px}.LxiGPq_srOnly{clip-path:inset(50%);white-space:nowrap;width:1px;height:1px;position:absolute;overflow:hidden}.LxiGPq_selectRow{justify-content:space-between;align-items:center;gap:8px;display:flex}.LxiGPq_selectActions{gap:8px;display:flex}.LxiGPq_preview{border:1px solid var(--dsw-alias-border-l1);border-radius:8px;flex-direction:column;gap:6px;max-height:34vh;padding:8px;display:flex;overflow-y:auto}.LxiGPq_candidate{background:var(--dsw-alias-bg-layer-2);border-radius:6px;align-items:flex-start;gap:8px;padding:6px;display:flex}.LxiGPq_candidateText{flex-direction:column;gap:2px;min-width:0;display:flex}.LxiGPq_candidateName{overflow-wrap:anywhere;font-size:12px;font-weight:600}.LxiGPq_candidateMeta{color:var(--dsw-alias-label-secondary);overflow-wrap:anywhere;font-size:11px}.LxiGPq_success{color:var(--dsw-alias-label-secondary);margin:0;font-size:12px}.LxiGPq_detail{color:var(--dsw-alias-label-secondary);overflow-wrap:anywhere;margin:0;font-size:11px}";
		const tagId = "@ctl456/dsh-skills-manager/SkillsManagerCard.module.css";
		if (typeof document !== "undefined" && document.querySelector("style[data-plugin-css=" + JSON.stringify(tagId) + "]") === null) {
			const tag = document.createElement("style");
			tag.dataset.plugin = "@ctl456/dsh-skills-manager";
			tag.dataset.pluginCss = tagId;
			tag.textContent = css;
			document.head.appendChild(tag);
		}
		var SkillsManagerCard_module_css_default = {
			"actions": "LxiGPq_actions",
			"badgeOff": "LxiGPq_badgeOff",
			"badgeOn": "LxiGPq_badgeOn",
			"button": "LxiGPq_button",
			"candidate": "LxiGPq_candidate",
			"candidateMeta": "LxiGPq_candidateMeta",
			"candidateName": "LxiGPq_candidateName",
			"candidateText": "LxiGPq_candidateText",
			"danger": "LxiGPq_danger",
			"description": "LxiGPq_description",
			"detail": "LxiGPq_detail",
			"dialogContent": "LxiGPq_dialogContent",
			"empty": "LxiGPq_empty",
			"error": "LxiGPq_error",
			"field": "LxiGPq_field",
			"fileName": "LxiGPq_fileName",
			"fileRow": "LxiGPq_fileRow",
			"header": "LxiGPq_header",
			"hint": "LxiGPq_hint",
			"input": "LxiGPq_input",
			"item": "LxiGPq_item",
			"itemActions": "LxiGPq_itemActions",
			"itemMeta": "LxiGPq_itemMeta",
			"itemName": "LxiGPq_itemName",
			"itemText": "LxiGPq_itemText",
			"label": "LxiGPq_label",
			"list": "LxiGPq_list",
			"notice": "LxiGPq_notice",
			"page": "LxiGPq_page",
			"pageInfo": "LxiGPq_pageInfo",
			"pager": "LxiGPq_pager",
			"preview": "LxiGPq_preview",
			"primary": "LxiGPq_primary",
			"problem": "LxiGPq_problem",
			"row": "LxiGPq_row",
			"search": "LxiGPq_search",
			"searchIcon": "LxiGPq_searchIcon",
			"searchWrap": "LxiGPq_searchWrap",
			"selectActions": "LxiGPq_selectActions",
			"selectRow": "LxiGPq_selectRow",
			"srOnly": "LxiGPq_srOnly",
			"success": "LxiGPq_success",
			"textarea": "LxiGPq_textarea",
			"title": "LxiGPq_title",
			"toggle": "LxiGPq_toggle",
			"toggleText": "LxiGPq_toggleText",
			"toolbar": "LxiGPq_toolbar"
		};
		//#endregion
		//#region src/client/SkillsManagerCard.tsx
		/** One single-line text control. */
		function TextField(props) {
			const change = (event) => {
				props.onChange(event.target.value);
			};
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("label", {
				className: SkillsManagerCard_module_css_default.field,
				htmlFor: props.id,
				children: [
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
						className: SkillsManagerCard_module_css_default.label,
						children: props.label
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
						id: props.id,
						className: SkillsManagerCard_module_css_default.input,
						type: "text",
						value: props.value,
						disabled: props.disabled,
						onChange: change
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
						className: SkillsManagerCard_module_css_default.hint,
						children: props.hint
					})
				]
			});
		}
		/** One multi-line text control. */
		function AreaField(props) {
			const change = (event) => {
				props.onChange(event.target.value);
			};
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("label", {
				className: SkillsManagerCard_module_css_default.field,
				htmlFor: props.id,
				children: [
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
						className: SkillsManagerCard_module_css_default.label,
						children: props.label
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("textarea", {
						id: props.id,
						className: SkillsManagerCard_module_css_default.textarea,
						rows: props.rows,
						value: props.value,
						disabled: props.disabled,
						onChange: change
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
						className: SkillsManagerCard_module_css_default.hint,
						children: props.hint
					})
				]
			});
		}
		/** One checkbox with a label and an explanation. */
		function ToggleField(props) {
			const change = (event) => {
				props.onChange(event.target.checked);
			};
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("label", {
				className: SkillsManagerCard_module_css_default.toggle,
				htmlFor: props.id,
				children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
					id: props.id,
					type: "checkbox",
					checked: props.checked,
					disabled: props.disabled,
					onChange: change
				}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
					className: SkillsManagerCard_module_css_default.toggleText,
					children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
						className: SkillsManagerCard_module_css_default.label,
						children: props.label
					}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
						className: SkillsManagerCard_module_css_default.hint,
						children: props.hint
					})]
				})]
			});
		}
		/** Render a byte count as something a person can compare at a glance. */
		function formatBytes(bytes) {
			if (bytes < 1024) return `${String(bytes)} B`;
			if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
			return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
		}
		/**
		* Read one picked file as base64, so the archive travels in the same JSON
		* request as a repository URL rather than needing a second upload channel.
		* @param file - the file the user picked.
		* @returns the staged archive, or null when the browser could not read it.
		*/
		async function stageArchive(file) {
			try {
				const bytes = new Uint8Array(await file.arrayBuffer());
				let binary = "";
				for (const byte of bytes) binary += String.fromCharCode(byte);
				return {
					name: file.name,
					base64: btoa(binary)
				};
			} catch {
				return null;
			}
		}
		/**
		* The import dialog: pick a source, preview it, then install what it offers.
		* The renderer injects the action face, so `hooks` is stripped here just as
		* the slot's InjectFace strips it for the section component.
		*/
		function ImportDialog(props) {
			const { t, state, face, disabled } = props;
			const listing = state.importListing;
			const ticked = listing?.skills.filter((skill) => skill.selected).length ?? 0;
			const installable = listing?.skills.filter((skill) => skill.problems.length === 0) ?? [];
			const choose = async (event) => {
				const file = event.target.files?.[0];
				event.target.value = "";
				if (file === void 0) return;
				face.setImportArchive(await stageArchive(file));
			};
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(_deepseek_ai_dsh_client_ui_primitives.Modal, {
				open: state.importOpen,
				onClose: () => {
					face.closeImport();
				},
				title: t("importTitle"),
				closeLabel: t("close"),
				contentClassName: SkillsManagerCard_module_css_default.dialogContent,
				footer: /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
					type: "button",
					className: SkillsManagerCard_module_css_default.button,
					onClick: () => {
						face.closeImport();
					},
					children: t("cancel")
				}), listing === null ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
					type: "button",
					className: SkillsManagerCard_module_css_default.primary,
					disabled: disabled || state.importBusy,
					onClick: () => {
						face.previewImport();
					},
					children: state.importBusy ? t("importPreviewing") : t("importPreview")
				}) : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
					type: "button",
					className: SkillsManagerCard_module_css_default.primary,
					disabled: disabled || state.importBusy || ticked === 0,
					onClick: () => {
						face.installImport();
					},
					children: state.importBusy ? t("importInstalling") : t("importInstall", { count: ticked })
				})] }),
				children: [
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
						className: SkillsManagerCard_module_css_default.hint,
						children: t("importIntro")
					}),
					state.importArchive === null ? /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)(TextField, {
						id: "skills-manager-import-source",
						label: t("importSource"),
						hint: t("importSourceHint"),
						value: state.importSource,
						disabled: disabled || state.importBusy,
						onChange: (text) => {
							face.setImportSource(text);
						}
					}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)(TextField, {
						id: "skills-manager-import-subdirectory",
						label: t("importSubdirectory"),
						hint: t("importSubdirectoryHint"),
						value: state.importSubdirectory,
						disabled: disabled || state.importBusy,
						onChange: (text) => {
							face.setImportSubdirectory(text);
						}
					})] }) : /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: SkillsManagerCard_module_css_default.field,
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
							className: SkillsManagerCard_module_css_default.label,
							children: t("importArchive")
						}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
							className: SkillsManagerCard_module_css_default.fileRow,
							children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
								className: SkillsManagerCard_module_css_default.fileName,
								children: state.importArchive.name
							}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
								type: "button",
								className: SkillsManagerCard_module_css_default.button,
								disabled: disabled || state.importBusy,
								onClick: () => {
									face.setImportArchive(null);
								},
								children: t("importClearArchive")
							})]
						})]
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: SkillsManagerCard_module_css_default.field,
						children: [
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
								className: SkillsManagerCard_module_css_default.label,
								children: t("importArchive")
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
								id: "skills-manager-import-archive",
								className: SkillsManagerCard_module_css_default.srOnly,
								type: "file",
								accept: ".zip,application/zip",
								disabled: disabled || state.importBusy,
								onChange: (event) => {
									choose(event);
								}
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
								className: SkillsManagerCard_module_css_default.fileRow,
								children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("label", {
									className: SkillsManagerCard_module_css_default.button,
									htmlFor: "skills-manager-import-archive",
									children: t("importChooseFile")
								}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
									className: SkillsManagerCard_module_css_default.hint,
									children: t("importArchiveHint")
								})]
							})
						]
					}),
					state.importError !== null ? /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
						className: SkillsManagerCard_module_css_default.error,
						role: "status",
						children: t(state.importError.key)
					}), state.importError.detail.length === 0 ? null : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
						className: SkillsManagerCard_module_css_default.detail,
						children: state.importError.detail
					})] }) : null,
					state.importResult !== null ? /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
						className: SkillsManagerCard_module_css_default.success,
						role: "status",
						children: t("importInstalled", { count: state.importResult.installed })
					}), state.importResult.skipped.length === 0 ? null : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
						className: SkillsManagerCard_module_css_default.detail,
						children: t("importSkippedNames", { names: state.importResult.skipped.join(", ") })
					})] }) : null,
					listing === null ? null : /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [
						listing.truncated ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
							className: SkillsManagerCard_module_css_default.error,
							role: "status",
							children: t("importTruncated")
						}) : null,
						/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
							className: SkillsManagerCard_module_css_default.selectRow,
							children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
								className: SkillsManagerCard_module_css_default.hint,
								children: listing.repository === void 0 ? listing.source : `${listing.repository}@${listing.ref ?? ""}`
							}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
								className: SkillsManagerCard_module_css_default.selectActions,
								children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
									type: "button",
									className: SkillsManagerCard_module_css_default.button,
									onClick: () => {
										for (const skill of installable) if (!skill.selected) face.toggleImportName(skill.name);
									},
									children: t("importSelectAll")
								}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
									type: "button",
									className: SkillsManagerCard_module_css_default.button,
									onClick: () => {
										for (const skill of installable) if (skill.selected) face.toggleImportName(skill.name);
									},
									children: t("importSelectNone")
								})]
							})]
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
							className: SkillsManagerCard_module_css_default.preview,
							children: listing.skills.map((skill) => /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("label", {
								className: SkillsManagerCard_module_css_default.candidate,
								children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
									type: "checkbox",
									checked: skill.selected,
									disabled: disabled || state.importBusy || skill.problems.length > 0,
									onChange: () => {
										face.toggleImportName(skill.name);
									}
								}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
									className: SkillsManagerCard_module_css_default.candidateText,
									children: [
										/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
											className: SkillsManagerCard_module_css_default.candidateName,
											children: skill.name
										}),
										skill.description.length === 0 ? null : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
											className: SkillsManagerCard_module_css_default.candidateMeta,
											children: skill.description
										}),
										/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
											className: SkillsManagerCard_module_css_default.candidateMeta,
											children: [
												t("importFiles", { count: skill.files }),
												` · ${formatBytes(skill.bytes)}`,
												skill.vendored ? ` · ${t("importVendored")}` : "",
												skill.dropped === 0 ? "" : ` · ${t("importDropped", { count: skill.dropped })}`
											]
										}),
										skill.problems.length === 0 ? null : /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
											className: SkillsManagerCard_module_css_default.problem,
											children: t("importProblemLabel")
										}), skill.problems.map((problem) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
											className: SkillsManagerCard_module_css_default.detail,
											children: problem
										}, problem))] })
									]
								})]
							}, `${skill.directory}/${skill.name}`))
						}),
						listing.skipped.length === 0 ? null : /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
							className: SkillsManagerCard_module_css_default.detail,
							children: [t("importSkippedTitle"), listing.skipped.map((entry) => entry.directory).join(", ")]
						})
					] })
				]
			});
		}
		/**
		* Render the Skills settings section.
		* @param props - locale copy, the section snapshot, and its actions.
		* @returns the section, or nothing while the Host does not serve the namespace.
		*/
		function SkillsManagerCard(props) {
			const { t } = props;
			const state = props.useSkillsManagerCard((snapshot) => snapshot);
			if (!state.available) return null;
			const disabled = !state.writable || state.saving;
			const { draft } = state;
			const edit = (field) => (text) => {
				props.edit(field, text);
			};
			const emptyText = state.skills.length === 0 ? t("empty") : t("noMatch");
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				className: SkillsManagerCard_module_css_default.page,
				children: [
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: SkillsManagerCard_module_css_default.header,
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("h2", {
							className: SkillsManagerCard_module_css_default.title,
							children: t("title")
						}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
							className: SkillsManagerCard_module_css_default.description,
							children: t("description")
						})]
					}),
					!state.writable ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
						className: SkillsManagerCard_module_css_default.notice,
						role: "status",
						children: t("readOnly")
					}) : null,
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: SkillsManagerCard_module_css_default.toolbar,
						children: [
							/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
								className: SkillsManagerCard_module_css_default.searchWrap,
								children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconSearchOutline16, {
									className: SkillsManagerCard_module_css_default.searchIcon,
									size: 14
								}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
									id: "skills-manager-search",
									className: SkillsManagerCard_module_css_default.search,
									type: "search",
									value: state.query,
									placeholder: t("searchPlaceholder"),
									"aria-label": t("search"),
									onChange: (event) => {
										props.setQuery(event.target.value);
									}
								})]
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("button", {
								type: "button",
								className: SkillsManagerCard_module_css_default.primary,
								disabled,
								onClick: () => {
									props.openAdd();
								},
								children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconPlusOutline16, { size: 14 }), t("addSkill")]
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
								type: "button",
								className: SkillsManagerCard_module_css_default.button,
								disabled,
								onClick: () => {
									props.openImport();
								},
								children: t("importSkill")
							})
						]
					}),
					state.visible.length === 0 ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
						className: SkillsManagerCard_module_css_default.empty,
						children: emptyText
					}) : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("ul", {
						className: SkillsManagerCard_module_css_default.list,
						"aria-label": t("list"),
						children: state.visible.map((skill) => /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("li", {
							className: SkillsManagerCard_module_css_default.item,
							children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
								className: SkillsManagerCard_module_css_default.itemText,
								children: [
									/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
										className: SkillsManagerCard_module_css_default.itemName,
										children: skill.name
									}),
									/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
										className: SkillsManagerCard_module_css_default.itemMeta,
										title: skill.description,
										children: skill.description
									}),
									/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
										className: SkillsManagerCard_module_css_default.itemMeta,
										children: [
											t("characters", { count: skill.characters }),
											skill.modelInvocable ? "" : ` · ${t("modelInvocable")}`,
											skill.userInvocable ? "" : ` · ${t("userInvocable")}`
										]
									}),
									skill.problems.map((problem) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
										className: SkillsManagerCard_module_css_default.problem,
										children: t(problem)
									}, problem))
								]
							}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
								className: SkillsManagerCard_module_css_default.itemActions,
								children: [
									/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
										className: skill.enabled ? SkillsManagerCard_module_css_default.badgeOn : SkillsManagerCard_module_css_default.badgeOff,
										children: skill.enabled ? t("enabled") : t("disabled")
									}),
									/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
										type: "button",
										className: SkillsManagerCard_module_css_default.button,
										disabled,
										onClick: () => {
											props.openEdit(skill.name);
										},
										children: t("edit")
									}),
									/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
										type: "button",
										className: SkillsManagerCard_module_css_default.button,
										disabled,
										onClick: () => {
											props.setEnabled(skill.name, !skill.enabled);
										},
										children: skill.enabled ? t("disable") : t("enable")
									}),
									/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
										type: "button",
										className: SkillsManagerCard_module_css_default.danger,
										disabled,
										onClick: () => {
											props.remove(skill.name);
										},
										children: t("remove")
									})
								]
							})]
						}, skill.name))
					}),
					state.pageCount > 1 ? /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: SkillsManagerCard_module_css_default.pager,
						children: [
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
								type: "button",
								className: SkillsManagerCard_module_css_default.button,
								"aria-label": t("prevPage"),
								disabled: state.page === 0,
								onClick: () => {
									props.setPage(state.page - 1);
								},
								children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconChevronLeftOutline14, { size: 14 })
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
								className: SkillsManagerCard_module_css_default.pageInfo,
								children: t("pageInfo", {
									page: state.page + 1,
									pages: state.pageCount
								})
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
								type: "button",
								className: SkillsManagerCard_module_css_default.button,
								"aria-label": t("nextPage"),
								disabled: state.page >= state.pageCount - 1,
								onClick: () => {
									props.setPage(state.page + 1);
								},
								children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconChevronRightOutline14, { size: 14 })
							})
						]
					}) : null,
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)(ImportDialog, {
						t,
						state,
						face: props,
						disabled
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)(_deepseek_ai_dsh_client_ui_primitives.Modal, {
						open: state.dialogOpen,
						onClose: () => {
							props.closeDialog();
						},
						title: state.editing === null ? t("addTitle") : t("editTitle"),
						closeLabel: t("close"),
						contentClassName: SkillsManagerCard_module_css_default.dialogContent,
						footer: /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
							type: "button",
							className: SkillsManagerCard_module_css_default.button,
							disabled: state.saving,
							onClick: () => {
								props.closeDialog();
							},
							children: t("cancel")
						}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
							type: "button",
							className: SkillsManagerCard_module_css_default.primary,
							disabled,
							onClick: () => {
								props.submit();
							},
							children: t("save")
						})] }),
						children: [
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)(TextField, {
								id: "skills-manager-name",
								label: t("name"),
								hint: t("nameHint"),
								value: draft.name,
								disabled: disabled || state.editing !== null,
								onChange: edit("name")
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)(TextField, {
								id: "skills-manager-description",
								label: t("descriptionLabel"),
								hint: t("descriptionHint"),
								value: draft.description,
								disabled,
								onChange: edit("description")
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)(TextField, {
								id: "skills-manager-when-to-use",
								label: t("whenToUse"),
								hint: t("whenToUseHint"),
								value: draft.whenToUse,
								disabled,
								onChange: edit("whenToUse")
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)(AreaField, {
								id: "skills-manager-content",
								label: t("content"),
								hint: t("contentHint"),
								rows: 8,
								value: draft.content,
								disabled,
								onChange: edit("content")
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)(ToggleField, {
								id: "skills-manager-model-invocable",
								label: t("modelInvocable"),
								hint: t("modelInvocableHint"),
								checked: draft.modelInvocable,
								disabled,
								onChange: (checked) => {
									props.setModelInvocable(checked);
								}
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)(ToggleField, {
								id: "skills-manager-user-invocable",
								label: t("userInvocable"),
								hint: t("userInvocableHint"),
								checked: draft.userInvocable,
								disabled,
								onChange: (checked) => {
									props.setUserInvocable(checked);
								}
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
								className: SkillsManagerCard_module_css_default.hint,
								children: t("published")
							}),
							state.error !== null ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
								className: SkillsManagerCard_module_css_default.error,
								role: "status",
								children: t(state.error)
							}) : null,
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
								className: SkillsManagerCard_module_css_default.actions,
								children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
									type: "button",
									className: SkillsManagerCard_module_css_default.button,
									disabled,
									onClick: () => {
										props.resetDraft();
									},
									children: t("reset")
								})
							})
						]
					})
				]
			});
		}
		//#endregion
		//#region src/client/card-controller.ts
		/**
		* The skills card's controller: bridge the `skills-manager` settings scope
		* onto a small form model, and turn explicit user gestures (add, edit,
		* remove, enable, disable) into revision-fenced settings writes.
		*
		* The card acts directly instead of staging a save: adding, editing, or
		* removing a skill is a discrete gesture, and the settings scope already
		* orders and fences each write, so a separate save step would only risk
		* leaving the card out of sync with the document.
		*
		* Draft validation mirrors the Host's `validateStoredSkill`, including the
		* limits, because the card can only see the settings document — the Host's
		* publish decision is not on this transport. Rejecting a bad draft before the
		* write is what keeps the two views agreeing.
		*
		* @module @ctl456/dsh-skills-manager/client/card-controller
		*/
		/** Settings namespace the card edits; the Host registers the same value. */
		const SKILLS_MANAGER_NS = "skills-manager";
		/** The registry's public skill-name grammar. */
		const SKILL_NAME_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
		/**
		* Path of the host import route. Kept as a literal rather than imported from
		* the host module: the browser bundle must not pull in host-only code, and the
		* path is part of the wire contract the route owns.
		*/
		const IMPORT_PATH = "/api/skills-manager.import";
		/** The empty add form. */
		function emptyDraft() {
			return {
				name: "",
				description: "",
				whenToUse: "",
				content: "",
				modelInvocable: true,
				userInvocable: true
			};
		}
		/** Project one stored skill onto the card's view, decoding defaults and diagnostics. */
		function toView(skill) {
			const whenToUse = skill.whenToUse ?? "";
			const problems = [];
			if (!SKILL_NAME_PATTERN.test(skill.name) || skill.name.length > 64) problems.push("problemName");
			if (skill.description.trim().length === 0 || skill.description.length > 1024) problems.push("problemDescription");
			if (whenToUse.length > 1024) problems.push("problemWhenToUse");
			if (skill.content.trim().length === 0 || skill.content.length > 262144) problems.push("problemContent");
			return {
				name: skill.name,
				description: skill.description,
				enabled: skill.enabled !== false,
				modelInvocable: skill.disableModelInvocation !== true,
				userInvocable: skill.userInvocable !== false,
				characters: skill.content.length,
				problems
			};
		}
		/** Whether one skill matches the filter text, which is case-insensitive over the name and description. */
		function matches(skill, query) {
			const needle = query.trim().toLowerCase();
			if (needle.length === 0) return true;
			return skill.name.toLowerCase().includes(needle) || skill.description.toLowerCase().includes(needle);
		}
		/** Recompute the filtered page after any change to the query, list, or page. */
		function applyFilter(state) {
			const filtered = state.skills.filter((skill) => matches(skill, state.query));
			state.matched = filtered.length;
			state.pageCount = Math.max(1, Math.ceil(filtered.length / 5));
			state.page = Math.min(Math.max(state.page, 0), state.pageCount - 1);
			const start = state.page * 5;
			state.visible = filtered.slice(start, start + 5);
		}
		/** Fill a draft from one stored skill. */
		function draftOf(skill) {
			return {
				name: skill.name,
				description: skill.description,
				whenToUse: skill.whenToUse ?? "",
				content: skill.content,
				modelInvocable: skill.disableModelInvocation !== true,
				userInvocable: skill.userInvocable !== false
			};
		}
		/**
		* Validate a draft and project it onto a stored entry.
		* @param draft - the staged form text.
		* @returns the entry to write, or the first refusal as a locale key.
		*/
		function draftToSkill(draft) {
			const name = draft.name.trim();
			if (!SKILL_NAME_PATTERN.test(name) || name.length > 64) return { error: "errorName" };
			const description = draft.description.trim();
			if (description.length === 0 || description.length > 1024) return { error: "errorDescription" };
			const whenToUse = draft.whenToUse.trim();
			if (whenToUse.length > 1024) return { error: "errorWhenToUse" };
			const content = draft.content;
			if (content.trim().length === 0 || content.length > 262144) return { error: "errorContent" };
			return { skill: {
				name,
				description,
				...whenToUse.length === 0 ? {} : { whenToUse },
				content,
				...draft.modelInvocable ? {} : { disableModelInvocation: true },
				...draft.userInvocable ? {} : { userInvocable: false }
			} };
		}
		/**
		* Map a host problem code onto what the user should be told.
		*
		* The card never shows the host's raw code: a beginner needs to know whether to
		* re-check the link, wait, or sign in, and each of those is a different
		* sentence. The host's own message is kept beside it as muted detail, because
		* it is the only thing that names the actual cause.
		* @param problem - the stable code the route answered with.
		* @returns the dictionary key for that cause.
		*/
		function importProblemKey(problem) {
			switch (problem) {
				case "not-found": return "importNotFound";
				case "rate-limited": return "importRateLimited";
				case "unauthorized": return "importUnauthorized";
				case "truncated": return "importTruncated";
				case "unreadable": return "importBadArchive";
				case "too-large": return "importTooLarge";
				case "empty": return "importEmpty";
				case "no-skills": return "importNoSkills";
				case "unsupported-host": return "importBadHost";
				case "not-a-skill-file": return "importBadSource";
				case "malformed": return "importBadSource";
				case "network": return "importNetwork";
				default: return "importFailed";
			}
		}
		/** Read one string field from an untrusted JSON object. */
		function text(value, fallback = "") {
			return typeof value === "string" ? value : fallback;
		}
		/** Read one number field from an untrusted JSON object. */
		function count(value) {
			return typeof value === "number" && Number.isFinite(value) ? value : 0;
		}
		/** Read one boolean field from an untrusted JSON object. */
		function flag(value) {
			return value === true;
		}
		/** Project one untrusted candidate onto the dialog's view. */
		function toCandidate(raw, selected) {
			const entry = typeof raw === "object" && raw !== null ? raw : {};
			const problems = Array.isArray(entry["problems"]) ? entry["problems"].filter((item) => typeof item === "string") : [];
			const name = text(entry["name"]);
			return {
				name,
				description: text(entry["description"]),
				directory: text(entry["directory"]),
				files: count(entry["files"]),
				bytes: count(entry["bytes"]),
				dropped: count(entry["dropped"]),
				vendored: flag(entry["vendored"]),
				problems,
				selected: selected.has(name)
			};
		}
		/** Project one untrusted listing onto the dialog's view, or null when it is not one. */
		function toListing(raw, selected) {
			if (typeof raw !== "object" || raw === null) return null;
			const entry = raw;
			const skills = Array.isArray(entry["skills"]) ? entry["skills"].map((item) => toCandidate(item, selected)) : [];
			const skipped = Array.isArray(entry["skipped"]) ? entry["skipped"].flatMap((item) => {
				if (typeof item !== "object" || item === null) return [];
				const row = item;
				return [{
					directory: text(row["directory"]),
					reason: text(row["reason"])
				}];
			}) : [];
			const repository = text(entry["repository"]);
			const ref = text(entry["ref"]);
			return {
				source: text(entry["source"]),
				...repository.length === 0 ? {} : { repository },
				...ref.length === 0 ? {} : { ref },
				truncated: flag(entry["truncated"]),
				skills,
				skipped
			};
		}
		/** Bridges the `skills-manager` settings scope onto the card's snapshot. */
		var SkillsManagerCardController = class {
			scope;
			fetcher;
			store;
			unsubscribe;
			/**
			* The import request currently on the wire. Closing the dialog aborts it, and
			* a request that is no longer this one drops its own answer: a host that
			* answers slowly must not resurrect a dialog the user has already dismissed.
			*/
			inflight;
			/**
			* @param scope - the bound settings scope for the `skills-manager` namespace.
			* @param fetcher - HTTP carrier for the host import route.
			*/
			constructor(scope, fetcher = (input, init) => fetch(input, init)) {
				this.scope = scope;
				this.fetcher = fetcher;
				this.store = (0, _deepseek_ai_dsh_client_store.createSnapshotStore)({
					available: false,
					writable: false,
					saving: false,
					error: null,
					skills: [],
					query: "",
					matched: 0,
					page: 0,
					pageCount: 1,
					visible: [],
					dialogOpen: false,
					editing: null,
					draft: emptyDraft(),
					importOpen: false,
					importBusy: false,
					importSource: "",
					importSubdirectory: "",
					importArchive: null,
					importListing: null,
					importError: null,
					importResult: null
				});
				this.unsubscribe = scope.subscribe(() => {
					this.project();
				});
				this.project();
			}
			/** Release the scope subscription and any read still on the wire. */
			dispose() {
				this.abortImport();
				this.unsubscribe();
			}
			/** Cancel the in-flight import request, if any. */
			abortImport() {
				this.inflight?.abort();
				this.inflight = void 0;
			}
			/**
			* Build the face the card's slot registration injects.
			* @returns the card's snapshot store and its gesture actions.
			*/
			inject() {
				return {
					hooks: { skillsManagerCard: this.store },
					setQuery: (query) => {
						this.store.update((state) => {
							state.query = query;
							state.page = 0;
							applyFilter(state);
						});
					},
					setPage: (page) => {
						this.store.update((state) => {
							state.page = page;
							applyFilter(state);
						});
					},
					openAdd: () => {
						this.store.update((state) => {
							state.dialogOpen = true;
							state.editing = null;
							state.error = null;
							state.draft = emptyDraft();
						});
					},
					openEdit: (name) => {
						const skill = this.stored().find((candidate) => candidate.name === name);
						this.store.update((state) => {
							state.dialogOpen = true;
							state.editing = skill?.name ?? null;
							state.error = null;
							state.draft = skill === void 0 ? emptyDraft() : draftOf(skill);
						});
					},
					closeDialog: () => {
						this.store.update((state) => {
							state.dialogOpen = false;
							state.editing = null;
							state.error = null;
							state.draft = emptyDraft();
						});
					},
					edit: (field, text) => {
						this.store.update((draft) => {
							draft.draft[field] = text;
						});
					},
					setModelInvocable: (modelInvocable) => {
						this.store.update((state) => {
							state.draft.modelInvocable = modelInvocable;
						});
					},
					setUserInvocable: (userInvocable) => {
						this.store.update((state) => {
							state.draft.userInvocable = userInvocable;
						});
					},
					submit: () => {
						this.submit();
					},
					remove: (name) => {
						this.write(this.stored().filter((skill) => skill.name !== name));
					},
					setEnabled: (name, enabled) => {
						this.write(this.stored().map((skill) => skill.name === name ? {
							...skill,
							enabled
						} : skill));
					},
					resetDraft: () => {
						this.store.update((state) => {
							const skill = state.editing === null ? void 0 : this.stored().find((candidate) => candidate.name === state.editing);
							state.draft = skill === void 0 ? emptyDraft() : draftOf(skill);
							state.error = null;
						});
					},
					openImport: () => {
						this.store.update((state) => {
							state.importOpen = true;
							state.importBusy = false;
							state.importSource = "";
							state.importSubdirectory = "";
							state.importArchive = null;
							state.importListing = null;
							state.importError = null;
							state.importResult = null;
						});
					},
					closeImport: () => {
						this.abortImport();
						this.store.update((state) => {
							state.importOpen = false;
							state.importBusy = false;
							state.importListing = null;
							state.importArchive = null;
							state.importError = null;
							state.importResult = null;
						});
					},
					setImportSource: (text) => {
						this.store.update((state) => {
							state.importSource = text;
							state.importArchive = null;
							state.importResult = null;
						});
					},
					setImportSubdirectory: (text) => {
						this.store.update((state) => {
							state.importSubdirectory = text;
						});
					},
					setImportArchive: (archive) => {
						this.store.update((state) => {
							state.importArchive = archive;
							state.importListing = null;
							state.importError = null;
							state.importResult = null;
							if (archive !== null) state.importSource = archive.name;
						});
					},
					toggleImportName: (name) => {
						this.store.update((state) => {
							if (state.importListing === null) return;
							state.importListing = {
								...state.importListing,
								skills: state.importListing.skills.map((skill) => skill.name === name && skill.problems.length === 0 ? {
									...skill,
									selected: !skill.selected
								} : skill)
							};
						});
					},
					previewImport: () => {
						this.read();
					},
					installImport: () => {
						this.import();
					}
				};
			}
			/** Ask the host what the staged source offers, and show it. */
			async read() {
				if (this.store.getSnapshot().importBusy) return;
				const body = this.requestBody();
				if (body === void 0) return;
				this.store.update((draft) => {
					draft.importBusy = true;
					draft.importError = null;
					draft.importListing = null;
					draft.importResult = null;
				});
				const answer = await this.post({
					action: "preview",
					...body
				});
				if (answer === void 0) return;
				this.store.update((draft) => {
					draft.importBusy = false;
					if (!answer.ok) {
						draft.importError = answer.error;
						return;
					}
					draft.importListing = {
						...answer.listing,
						skills: answer.listing.skills.map((skill) => ({
							...skill,
							selected: skill.problems.length === 0
						}))
					};
				});
			}
			/** Install every ticked skill from the staged source. */
			async import() {
				const state = this.store.getSnapshot();
				if (state.importBusy || state.importListing === null) return;
				const names = state.importListing.skills.filter((skill) => skill.selected).map((skill) => skill.name);
				if (names.length === 0) return;
				const body = this.requestBody();
				if (body === void 0) return;
				this.store.update((draft) => {
					draft.importBusy = true;
					draft.importError = null;
					draft.importResult = null;
				});
				const answer = await this.post({
					action: "install",
					skills: names,
					...body
				});
				if (answer === void 0) return;
				this.store.update((draft) => {
					draft.importBusy = false;
					if (!answer.ok) {
						draft.importError = answer.error;
						return;
					}
					draft.importResult = answer.result;
					draft.importListing = null;
				});
			}
			/** The staged source as request fields, or undefined when the user staged nothing usable. */
			requestBody() {
				const state = this.store.getSnapshot();
				if (state.importArchive !== null) return { archive: {
					name: state.importArchive.name,
					base64: state.importArchive.base64
				} };
				const source = state.importSource.trim();
				if (source.length === 0) {
					this.store.update((draft) => {
						draft.importError = {
							key: "importNeedSource",
							detail: ""
						};
					});
					return;
				}
				const subdirectory = state.importSubdirectory.trim();
				return {
					source,
					...subdirectory.length === 0 ? {} : { subdirectory }
				};
			}
			/**
			* Post one import request and decode the answer, turning any failure into a
			* view.
			* @param body - the request the dialog staged.
			* @returns the decoded answer, or undefined when the request was superseded
			* (the dialog closed, or a newer request replaced it) and has nothing to say.
			*/
			async post(body) {
				this.abortImport();
				const controller = new AbortController();
				this.inflight = controller;
				/** Whether this request is still the one the dialog is waiting on. */
				const current = () => this.inflight === controller;
				let response;
				try {
					response = await this.fetcher(IMPORT_PATH, {
						method: "POST",
						headers: { "content-type": "application/json" },
						body: JSON.stringify(body),
						signal: controller.signal
					});
				} catch {
					return current() ? {
						ok: false,
						error: {
							key: "importNetwork",
							detail: ""
						}
					} : void 0;
				}
				if (!current()) return void 0;
				let parsed;
				try {
					parsed = await response.json();
				} catch {
					return current() ? {
						ok: false,
						error: {
							key: "importNetwork",
							detail: ""
						}
					} : void 0;
				}
				if (!current()) return void 0;
				this.inflight = void 0;
				const payload = typeof parsed === "object" && parsed !== null ? parsed : {};
				if (payload["ok"] !== true) return {
					ok: false,
					error: {
						key: importProblemKey(text(payload["problem"], "internal")),
						detail: text(payload["message"])
					}
				};
				const selected = new Set(this.store.getSnapshot().importListing?.skills.filter((skill) => skill.selected).map((skill) => skill.name) ?? []);
				const listing = toListing(payload["listing"], selected);
				const installed = Array.isArray(payload["installed"]) ? payload["installed"] : [];
				const skipped = Array.isArray(payload["skipped"]) ? payload["skipped"].flatMap((item) => {
					if (typeof item !== "object" || item === null) return [];
					const name = text(item["name"]);
					return name.length === 0 ? [] : [name];
				}) : [];
				return {
					ok: true,
					listing: listing ?? {
						source: text(payload["source"]),
						truncated: false,
						skills: [],
						skipped: []
					},
					result: {
						installed: installed.length,
						skipped
					}
				};
			}
			/** Copy the resolved scope value onto the card state. */
			project() {
				const snapshot = this.scope.getSnapshot();
				this.store.update((state) => {
					state.available = snapshot.status === "ready";
					state.writable = snapshot.writable;
					state.skills = (snapshot.value?.skills ?? []).map(toView);
					applyFilter(state);
				});
			}
			/** The currently stored skills, verbatim, so a write round-trips untouched fields. */
			stored() {
				return [...this.scope.getSnapshot().value?.skills ?? []];
			}
			/** Validate and write the staged skill. */
			async submit() {
				if (!this.store.getSnapshot().available) return;
				const draft = this.store.getSnapshot().draft;
				const parsed = draftToSkill(draft);
				if ("error" in parsed) {
					this.store.update((state) => {
						state.error = parsed.error;
					});
					return;
				}
				const entry = stripUndefined(parsed.skill);
				const next = this.stored().filter((skill) => skill.name !== entry.name);
				next.push(entry);
				if (await this.write(next)) this.store.update((state) => {
					state.draft = emptyDraft();
					state.dialogOpen = false;
					state.editing = null;
				});
			}
			/**
			* Persist one skill list.
			* @param next - the complete next list for the namespace's `skills` field.
			* @returns whether the Host accepted the write.
			*/
			async write(next) {
				if (!this.store.getSnapshot().available) return false;
				if (!this.store.getSnapshot().writable) {
					this.store.update((state) => {
						state.error = "readOnly";
					});
					return false;
				}
				this.store.update((state) => {
					state.saving = true;
					state.error = null;
				});
				try {
					await this.scope.set("skills", next);
					this.store.update((state) => {
						state.saving = false;
					});
					return true;
				} catch {
					this.store.update((state) => {
						state.saving = false;
						state.error = "saveFailed";
					});
					return false;
				}
			}
		};
		/** Drop optional fields the form left unset. */
		function stripUndefined(skill) {
			const entry = {};
			for (const [key, value] of Object.entries(skill))
 /* v8 ignore next -- draftToSkill only ever assigns defined fields */
			if (value !== void 0) entry[key] = value;
			return entry;
		}
		//#endregion
		//#region src/client/locales.ts
		/** `settings.skills-manager` dictionary: the skills card's copy. */
		/** Simplified Chinese dictionary (the key-set source of truth). */
		const zh = {
			title: "技能（Skills）",
			description: "管理 harness 可以调用的技能；添加后模型即可通过 skill 工具加载它们",
			unavailable: "当前部署未启用技能管理器",
			readOnly: "当前部署的设置为只读，无法在这里修改。",
			empty: "还没有添加任何技能。添加一个后，模型就能在对话中调用它。",
			noMatch: "没有匹配的技能，换个关键字试试。",
			list: "已配置的技能",
			search: "搜索技能",
			searchPlaceholder: "按名称或描述筛选",
			addSkill: "添加技能",
			addTitle: "添加技能",
			editTitle: "编辑技能",
			close: "关闭",
			cancel: "取消",
			save: "保存",
			reset: "清空",
			prevPage: "上一页",
			nextPage: "下一页",
			pageInfo: "第 {page} / {pages} 页",
			name: "名称",
			nameHint: "小写字母、数字和连字符，例如 release-notes。模型用这个名字调用技能。",
			descriptionLabel: "描述",
			descriptionHint: "一句话说明这个技能做什么、什么时候用；模型据此决定是否加载。",
			whenToUse: "何时使用（可选）",
			whenToUseHint: "补充说明触发场景，例如“当用户要求整理发布说明时”。",
			content: "技能内容",
			contentHint: "Markdown 格式的操作说明。写清步骤，模型加载后会照着做。",
			modelInvocable: "允许模型自动调用",
			modelInvocableHint: "关闭后技能仍会保存，但不会出现在模型的技能目录里。",
			userInvocable: "允许用 / 唤出",
			userInvocableHint: "关闭后技能不会出现在输入框的 / 技能列表中。",
			enabled: "已启用",
			disabled: "已停用",
			enable: "启用",
			disable: "停用",
			edit: "编辑",
			remove: "删除",
			characters: "{count} 字符",
			published: "保存后立即可用，无需重启。",
			problemName: "名称不是合法的小写连字符格式。",
			problemDescription: "描述不能为空。",
			problemWhenToUse: "“何时使用”太长。",
			problemContent: "技能内容不能为空。",
			errorName: "名称必须是小写字母、数字和单个连字符组合，最长 64 个字符。",
			errorDescription: "描述不能为空，且最长 1024 个字符。",
			errorWhenToUse: "“何时使用”最长 1024 个字符。",
			errorContent: "技能内容不能为空，且最长 262144 个字符。",
			errorDuplicate: "已存在同名技能，保存会覆盖它。",
			saveFailed: "保存失败，请检查后重试。",
			importSkill: "从 GitHub 导入",
			importTitle: "导入技能",
			importIntro: "粘贴 GitHub 仓库链接，或选择一个 .zip 压缩包。先预览，确认无误再安装。",
			importSource: "GitHub 仓库",
			importSourceHint: "支持仓库地址、/tree/分支/目录 链接，或 owner/repo 简写。",
			importSourcePlaceholder: "https://github.com/owner/repo",
			importSubdirectory: "限定目录（可选）",
			importSubdirectoryHint: "仓库里技能很多时，填一个目录只读取它，例如 skills/rev-frida。",
			importSubdirectoryPlaceholder: "例如 skills/rev-frida",
			importArchive: "或选择压缩包",
			importArchiveHint: "一个 .zip 文件，最大 8 MB；压缩包外面那层文件夹会被自动去掉。",
			importChooseFile: "选择文件",
			importClearArchive: "移除",
			importPreview: "预览",
			importPreviewing: "正在读取…",
			importInstall: "安装所选 {count} 个",
			importInstalling: "正在安装…",
			importSelectAll: "全选",
			importSelectNone: "全不选",
			importFiles: "{count} 个文件",
			importSize: "{size}",
			importDropped: "另有 {count} 个文件超出限制，未包含",
			importVendored: "可能是副本",
			importProblemLabel: "无法安装",
			importTruncated: "仓库太大，GitHub 只返回了部分内容；请用“限定目录”缩小范围。",
			importSkippedTitle: "同名目录已跳过：",
			importInstalled: "已安装 {count} 个技能，现在就能在对话里调用。",
			importSkippedNames: "未安装：{names}",
			importNeedSource: "请先填写仓库地址，或选择一个压缩包。",
			importBadSource: "这个链接看不懂，请确认是 GitHub 仓库地址。",
			importBadHost: "只支持 GitHub 链接。",
			importNotFound: "找不到这个仓库或分支，请检查链接。",
			importRateLimited: "GitHub 访问次数已达上限，请稍后再试；也可在插件配置里填写 token。",
			importUnauthorized: "GitHub 拒绝了访问；私有仓库需要在插件配置里填写 token。",
			importBadArchive: "这个压缩包读不出来，请确认是完整的 .zip 文件。",
			importTooLarge: "文件太大，超出限制。",
			importEmpty: "这个来源里没有找到技能。",
			importNoSkills: "读到了目录，但没有可安装的技能。",
			importNetwork: "网络请求失败，请检查连接后重试。",
			importFailed: "导入失败，请稍后重试。"
		};
		/** English dictionary, checked complete against the zh key set. */
		const en = {
			title: "Skills",
			description: "Manage the skills the harness can use; once added, the model loads them with its skill tool",
			unavailable: "This deployment does not compose the skills manager.",
			readOnly: "This deployment stores settings read-only; they cannot be changed here.",
			empty: "No skill is configured yet. Add one and the model can use it in the conversation.",
			noMatch: "No skill matches the filter; try another keyword.",
			list: "Configured skills",
			search: "Search skills",
			searchPlaceholder: "Filter by name or description",
			addSkill: "Add skill",
			addTitle: "Add a skill",
			editTitle: "Edit skill",
			close: "Close",
			cancel: "Cancel",
			save: "Save",
			reset: "Clear",
			prevPage: "Previous page",
			nextPage: "Next page",
			pageInfo: "Page {page} of {pages}",
			name: "Name",
			nameHint: "Lowercase letters, digits, and hyphens, for example release-notes. The model loads the skill by this name.",
			descriptionLabel: "Description",
			descriptionHint: "One line saying what the skill does and when to use it; the model routes on this.",
			whenToUse: "When to use (optional)",
			whenToUseHint: "Extra triggering guidance, for example \"when the user asks for release notes\".",
			content: "Instructions",
			contentHint: "The procedure in Markdown. Write the steps the model should follow after loading it.",
			modelInvocable: "Let the model invoke it",
			modelInvocableHint: "When off, the skill is stored but stays out of the model catalog.",
			userInvocable: "Show in the / menu",
			userInvocableHint: "When off, the skill stays out of the composer slash list.",
			enabled: "Enabled",
			disabled: "Disabled",
			enable: "Enable",
			disable: "Disable",
			edit: "Edit",
			remove: "Remove",
			characters: "{count} characters",
			published: "Available immediately after saving; no restart needed.",
			problemName: "The name is not valid kebab-case.",
			problemDescription: "The description is empty.",
			problemWhenToUse: "The \"when to use\" note is too long.",
			problemContent: "The instructions are empty.",
			errorName: "The name must be lowercase letters, digits, and single hyphens, at most 64 characters.",
			errorDescription: "The description must be non-empty and at most 1024 characters.",
			errorWhenToUse: "The \"when to use\" note must be at most 1024 characters.",
			errorContent: "The instructions must be non-empty and at most 262144 characters.",
			errorDuplicate: "A skill with this name already exists; saving replaces it.",
			saveFailed: "Saving failed; check the values and try again.",
			importSkill: "Import from GitHub",
			importTitle: "Import skills",
			importIntro: "Paste a GitHub repository link, or pick a .zip archive. Preview first, then install what you want.",
			importSource: "GitHub repository",
			importSourceHint: "A repository URL, a /tree/<ref>/<dir> link, or an owner/repo shorthand.",
			importSourcePlaceholder: "https://github.com/owner/repo",
			importSubdirectory: "Limit to a directory (optional)",
			importSubdirectoryHint: "When a repository holds many skills, name one directory to read, for example skills/rev-frida.",
			importSubdirectoryPlaceholder: "for example skills/rev-frida",
			importArchive: "Or pick an archive",
			importArchiveHint: "One .zip file, at most 8 MB; a single wrapping folder inside it is removed automatically.",
			importChooseFile: "Choose file",
			importClearArchive: "Remove",
			importPreview: "Preview",
			importPreviewing: "Reading…",
			importInstall: "Install {count} selected",
			importInstalling: "Installing…",
			importSelectAll: "Select all",
			importSelectNone: "Select none",
			importFiles: "{count} files",
			importSize: "{size}",
			importDropped: "{count} more files exceeded a limit and are not included",
			importVendored: "possible duplicate",
			importProblemLabel: "Cannot install",
			importTruncated: "The repository is too large for GitHub to list at once; narrow it with \"Limit to a directory\".",
			importSkippedTitle: "Skipped directories with a duplicate name:",
			importInstalled: "Installed {count} skills; they are usable in the conversation now.",
			importSkippedNames: "Not installed: {names}",
			importNeedSource: "Enter a repository address or choose an archive first.",
			importBadSource: "That link could not be read; check that it is a GitHub repository address.",
			importBadHost: "Only GitHub links are supported.",
			importNotFound: "That repository or branch was not found; check the link.",
			importRateLimited: "GitHub is rate-limiting this address; try again later, or set a token in the plugin config.",
			importUnauthorized: "GitHub refused the request; a private repository needs a token in the plugin config.",
			importBadArchive: "That archive could not be read; check that it is a complete .zip file.",
			importTooLarge: "The file is larger than the limit.",
			importEmpty: "No skill was found at this source.",
			importNoSkills: "Directories were found, but none is an installable skill.",
			importNetwork: "The network request failed; check the connection and try again.",
			importFailed: "The import failed; try again later."
		};
		//#endregion
		//#region src/client/index.ts
		/** Locale namespace owning this card's copy. */
		const NS = "settings.skills-manager";
		/** Required client services: the slot registry, locale, remote, and settings transport. */
		const inject = [
			"slots",
			"locale",
			"remote",
			"settingsScope"
		];
		/**
		* Register the skills manager's browser surface.
		* @param ctx - the client plugin context.
		*/
		function apply(ctx) {
			ctx.effect(() => ctx.locale.register(NS, {
				zh,
				en
			}), "ui-skills-manager: dictionaries");
			const controller = new SkillsManagerCardController(ctx.settingsScope.bind({ namespace: SKILLS_MANAGER_NS }));
			ctx.effect(() => () => {
				controller.dispose();
			}, "ui-skills-manager: card controller");
			ctx.slots.inject("settings.section", () => ctx.slots.register({
				name: "settings.section",
				id: SKILLS_MANAGER_NS,
				order: 26,
				label: () => ctx.locale.bind(NS)("title"),
				locale: NS,
				inject: () => controller.inject()
			}, SkillsManagerCard));
		}
		//#endregion
		exports.SKILLS_MANAGER_NS = SKILLS_MANAGER_NS;
		exports.apply = apply;
		exports.inject = inject;
		return module.exports;
	}
});

//# sourceMappingURL=client.js.map