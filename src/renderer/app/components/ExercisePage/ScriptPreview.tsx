import { BookOpen, Maximize2, X } from 'lucide-react'
import { AnimatePresence, motion } from 'motion/react'
import { useState } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

interface Props {
    content: string
    sectionId?: string
    anchor?: string
}

export function ScriptPreview({ content }: Props) {
    const [isExpanded, setIsExpanded] = useState(false)

    return (
        <div className="w-full px-4 py-6">
            <AnimatePresence>
                {isExpanded ? (
                    <>
                        {/* Backdrop - Fixed to viewport */}
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="fixed inset-0 z-[60] bg-black/60 backdrop-blur-sm cursor-pointer"
                            onClick={() => setIsExpanded(false)}
                        />

                        {/* Expanded Window - Fixed centering */}
                        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 md:p-8 pointer-events-none">
                            <motion.div
                                layoutId="script-container"
                                className="w-full h-full md:w-[80%] xl:w-[70%] md:h-[90%] bg-neutral-900 border border-neutral-800 flex flex-col shadow-2xl overflow-hidden pointer-events-auto rounded-xl"
                                initial={{ borderRadius: 12 }}
                                animate={{ borderRadius: 12 }}
                                exit={{ borderRadius: 12 }}
                                onClick={(e) => e.stopPropagation()}
                                transition={{
                                    duration: 0.6,
                                    ease: [0.165, 0.84, 0.44, 1], // easeOutCirc
                                }}
                            >
                                {/* Fullscreen header */}
                                <motion.div
                                    className="flex items-center justify-between px-6 py-4 border-b border-neutral-800 bg-neutral-900"
                                    layoutId="script-header"
                                >
                                    <div className="flex items-center gap-3">
                                        <BookOpen className="w-5 h-5 text-blue-400" />
                                        <span className="font-medium text-neutral-200">
                                            Script / Vorlesungsunterlagen
                                        </span>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={(e) => {
                                            e.stopPropagation()
                                            setIsExpanded(false)
                                        }}
                                        className="p-2 rounded-lg text-neutral-400 hover:text-white hover:bg-neutral-800 transition-colors"
                                    >
                                        <X className="w-5 h-5" />
                                    </button>
                                </motion.div>

                                {/* Fullscreen content */}
                                <motion.div
                                    className="flex-1 overflow-y-auto p-6"
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                    exit={{ opacity: 0 }}
                                    transition={{ duration: 0.2, delay: 0.1 }}
                                >
                                    <div
                                        className="max-w-none prose prose-invert prose-neutral prose-sm md:prose-base lg:prose-lg max-w-none
                                        prose-headings:font-bold prose-headings:tracking-tight
                                        prose-h1:text-3xl prose-h2:text-2xl prose-h3:text-xl
                                        prose-code:bg-neutral-800 prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded-md prose-code:before:content-none prose-code:after:content-none
                                        prose-pre:bg-neutral-900 prose-pre:border prose-pre:border-neutral-800
                                        prose-img:rounded-lg prose-img:border prose-img:border-neutral-800"
                                    >
                                        <ReactMarkdown remarkPlugins={[remarkGfm]}>
                                            {content}
                                        </ReactMarkdown>
                                    </div>
                                </motion.div>
                            </motion.div>
                        </div>
                    </>
                ) : (
                    <motion.div
                        layoutId="script-container"
                        onClick={() => setIsExpanded(true)}
                        className="max-w-3xl mx-auto bg-neutral-900/50 border border-neutral-800 rounded-xl overflow-hidden cursor-pointer group relative shadow-lg hover:border-neutral-700 transition-colors"
                        whileHover={{ scale: 1.01 }}
                        transition={{
                            duration: 0.6,
                            ease: [0.165, 0.84, 0.44, 1],
                        }}
                    >
                        {/* Header */}
                        <motion.div
                            className="flex items-center justify-between px-4 py-3 border-b border-neutral-800/50 bg-neutral-900/30"
                            layoutId="script-header"
                        >
                            <div className="flex items-center gap-2">
                                <BookOpen className="w-4 h-4 text-blue-400" />
                                <span className="text-sm font-medium text-neutral-300">Script</span>
                            </div>
                            <div className="text-neutral-500 group-hover:text-blue-400 transition-colors">
                                <Maximize2 className="w-4 h-4" />
                            </div>
                        </motion.div>

                        {/* Preview content */}
                        <div className="px-4 py-4 max-h-[160px] overflow-hidden relative">
                            <div className="prose prose-invert prose-sm max-w-none select-none pointer-events-none opacity-80">
                                <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
                            </div>

                            {/* Fade overlay */}
                            <div className="absolute inset-0 bg-gradient-to-t from-neutral-900 via-transparent to-transparent" />
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    )
}
