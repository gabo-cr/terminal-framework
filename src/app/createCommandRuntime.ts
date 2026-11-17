import { CompletionEngine } from '../core/CompletionEngine'
import type { Configuration } from '../configuration/ConfigurationLoader'
import { createContentService } from '../content/createContentService'
import type { ContentServiceOptions } from '../content/createContentService'
import { CommandExecutor } from '../core/CommandExecutor'
import { CommandRegistry } from '../core/CommandRegistry'

export function createCommandRuntime(configuration: Configuration, options: ContentServiceOptions) {
  const content = createContentService(configuration.content, options)
  const registry = new CommandRegistry(configuration.commands.commands)
  const executor = new CommandExecutor({ registry, content, locale: configuration.site.locale })
  const completion = new CompletionEngine({ registry, catalog: content, locale: configuration.site.locale })
  return { content, executor, completion }
}
