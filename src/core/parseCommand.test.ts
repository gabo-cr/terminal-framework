import { describe, expect, it } from 'vitest'
import { parseCommand } from './parseCommand'

describe('parseCommand', () => {
  it.each(['help', 'clear', 'history', 'unknown-command', 'HELP', '123', 'Ingeniería'])('acepta un nombre sin consultar su existencia: %s', (name) => {
    expect(parseCommand(name)).toEqual({ status: 'valid', command: { name } })
  })

  it.each([
    ['essays intro', 'essays', 'intro'],
    [' Essays   My-Document ', 'Essays', 'My-Document'],
    ['\tessays\t\tIntro\t', 'essays', 'Intro'],
    ['\n essays intro \r\n', 'essays', 'intro'],
    ['essays\u00a0intro', 'essays', 'intro'],
    ['ideas Ámbito', 'ideas', 'Ámbito'],
    ['essays 123', 'essays', '123'],
  ])('separa y conserva los tokens de %j', (input, name, argument) => {
    expect(parseCommand(input)).toEqual({ status: 'valid', command: { name, argument } })
  })

  it('elimina espacios exteriores sin inventar un argumento', () => {
    expect(parseCommand(' \t help \r\n')).toEqual({ status: 'valid', command: { name: 'help' } })
  })

  it.each(['', ' ', '   ', '\t', '\r\n', '\u00a0', ' \t\r\n '])('trata %j como ausencia de comando', (input) => {
    expect(parseCommand(input)).toEqual({ status: 'empty' })
  })

  it.each(['essays one two', '  essays  one   two  ', 'a b c d', 'a\tb\tc'])('rechaza argumentos adicionales: %j', (input) => {
    expect(parseCommand(input)).toEqual({ status: 'error', code: 'TOO_MANY_ARGUMENTS' })
  })

  it.each([
    'help --all', 'help -a', '--help', 'essays -1',
    'essays "intro"', "essays 'intro'", '"help"', 'essays "two words"',
    'help|history', 'help | history', 'help>file', 'help >>file', 'help <file',
    'help;clear', 'help&&clear', 'help & clear', 'help||clear',
    'help\nclear', 'help\rclear', 'help\r\nclear', 'help\u2028clear', 'help\u2029clear',
    'help `clear`', 'essays my\\ document',
  ])('rechaza sintaxis fuera del MVP: %j', (input) => {
    expect(parseCommand(input)).toEqual({ status: 'error', code: 'UNSUPPORTED_SYNTAX' })
  })

  it('no comparte estado entre ejecuciones', () => {
    const result = parseCommand('essays Intro')
    if (result.status === 'valid') result.command.name = 'changed'
    expect(parseCommand('essays Intro')).toEqual({ status: 'valid', command: { name: 'essays', argument: 'Intro' } })
  })
})
