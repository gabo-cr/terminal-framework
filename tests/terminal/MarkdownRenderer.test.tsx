// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { MarkdownRenderer } from '../../src/terminal/MarkdownRenderer'
import { TerminalOutput } from '../../src/terminal/TerminalOutput'

afterEach(cleanup)

describe('MarkdownRenderer', () => {
  it('renderiza encabezados, párrafos, énfasis, listas, citas y separadores', () => {
    const { container } = render(<MarkdownRenderer markdown={[
      '# Principal', '## Sección', '### Subsección', '#### Cuarto', '##### Quinto', '###### Sexto',
      'Un **texto importante** y una *idea*.', '- Primero\n- Segundo', '1. Uno\n2. Dos',
      '> Una cita', '---', 'Otro párrafo.',
    ].join('\n\n')} />)
    expect(screen.getAllByRole('heading')).toHaveLength(6)
    expect(screen.getByRole('heading', { level: 2 }).textContent).toBe('Sección')
    expect(container.querySelector('strong')?.textContent).toBe('texto importante')
    expect(container.querySelector('em')?.textContent).toBe('idea')
    expect(container.querySelectorAll('li')).toHaveLength(4)
    expect(container.querySelector('ul')).toBeTruthy()
    expect(container.querySelector('ol')).toBeTruthy()
    expect(container.querySelector('blockquote')?.textContent).toContain('Una cita')
    expect(screen.getByRole('separator')).toBeTruthy()
    expect(container.querySelectorAll('p').length).toBeGreaterThanOrEqual(3)
  })

  it('conserva código en línea y espacios de bloques sin interpretar su HTML', () => {
    const code = `const text = '<img src=x onerror=alert(1)>'\n  ${'x'.repeat(300)}\n`
    const { container } = render(<MarkdownRenderer markdown={'Usa `useState` aquí.\n\n```tsx\n' + code + '```'} />)
    expect(container.querySelector('p code')?.textContent).toBe('useState')
    const pre = container.querySelector('pre')!
    expect(pre.textContent).toBe(code)
    expect(pre.tabIndex).toBe(0)
    expect(pre.querySelector('code')?.className).toContain('language-tsx')
    expect(container.querySelector('img')).toBeNull()
  })

  it('descarta HTML crudo, scripts y atributos ejecutables', () => {
    const { container } = render(<MarkdownRenderer markdown={'<script>alert(1)</script>\n\n<img src=x onerror=alert(1)>\n\n<iframe src="https://example.com"></iframe>\n\nTexto **seguro**.'} />)
    expect(container.querySelector('script, img, iframe')).toBeNull()
    expect(container.querySelector('[onerror]')).toBeNull()
    expect(container.querySelector('strong')?.textContent).toBe('seguro')
  })

  it.each([
    'javascript:alert(1)', 'JaVaScRiPt:alert(1)', 'java&#x73;cript:alert(1)',
    'javascript&#58;alert(1)', 'data:text/html,attack', 'vbscript:attack',
    'file:///etc/passwd', 'ftp://example.com/file', 'java&#10;script:attack',
  ])('bloquea URL no permitida: %s', (url) => {
    const { container } = render(<MarkdownRenderer markdown={`[destino](${url})`} />)
    expect(container.querySelector('a')).toBeNull()
    expect(container.textContent).toContain('destino')
  })

  it.each(['https://example.com/path', 'http://example.com/path', '//example.com/path'])('aísla enlaces web absolutos: %s', (url) => {
    render(<MarkdownRenderer markdown={`[sitio](${url})`} />)
    const link = screen.getByRole('link', { name: 'sitio' })
    expect(link.getAttribute('href')).toBe(url)
    expect(link.getAttribute('target')).toBe('_blank')
    expect(link.getAttribute('rel')).toBe('noopener noreferrer')
  })

  it.each(['#section', 'notes/intro.md', '/info', 'mailto:hola@example.com'])('conserva enlaces relativos, fragmentos y correo: %s', (url) => {
    render(<MarkdownRenderer markdown={`[destino](${url})`} />)
    const link = screen.getByRole('link', { name: 'destino' })
    expect(link.getAttribute('href')).toBe(url)
    expect(link.getAttribute('target')).toBeNull()
  })

  it('presenta la alternativa de las imágenes sin provocar solicitudes de imagen', () => {
    const { container } = render(<MarkdownRenderer markdown="![Diagrama ficticio](https://example.com/image.png)" />)
    expect(container.querySelector('img')).toBeNull()
    expect(screen.getByText('Diagrama ficticio')).toBeTruthy()
  })
})

describe('TerminalOutput', () => {
  it('mantiene texto literal sin interpretar Markdown ni HTML', () => {
    const { container } = render(<TerminalOutput result={{ type: 'text', text: '**Texto**\n<script>inofensivo</script>' }} />)
    expect(container.textContent).toBe('**Texto**\n<script>inofensivo</script>')
    expect(container.querySelector('script, strong')).toBeNull()
  })

  it('muestra lista ordenada con ID, título y descripción opcional', () => {
    render(<TerminalOutput result={{ type: 'list', title: 'Taller', items: [
      { id: 'second', title: 'Segundo', description: 'Descripción ficticia' }, { id: 'first', title: 'Primero' },
    ] }} />)
    expect(screen.getByText('Taller')).toBeTruthy()
    expect(screen.getAllByRole('listitem').map(({ textContent }) => textContent)).toEqual([
      'second — Segundo: Descripción ficticia', 'first — Primero',
    ])
  })

  it('presenta solo el mensaje público del error con diferenciación accesible', () => {
    const { container } = render(<TerminalOutput result={{ type: 'error', code: 'CONTENT_ERROR', message: 'No se pudo cargar.', cause: new Error('detalle privado') }} />)
    expect(screen.getByRole('alert').textContent).toBe('No se pudo cargar.')
    expect(screen.getByRole('alert').className).toContain('text-rose-200')
    expect(container.textContent).not.toContain('detalle privado')
  })

  it('no presenta clear como contenido', () => {
    const { container } = render(<TerminalOutput result={{ type: 'clear' }} />)
    expect(container.innerHTML).toBe('')
  })
})
