import m, { Component, Vnode } from 'mithril'

import FoxyProxyConverter from './FoxyProxyConverter'
import { uuidv4 } from '../util'
import { ProxyDao, Store } from '../../store/Store'

const t = browser.i18n.getMessage

export default class ImportPage implements Component {
  proxiesToImport: ProxyDao[] = []
  importError?: string
  store: Store

  cleanUp?: () => void

  foxyProxyFileInput: FileInput

  constructor ({ store }: { store: Store }) {
    this.store = store
    this.foxyProxyFileInput = new FileInput({
      title: t('ImportPage_foxyProxyInputLabel'),
      onChange: this.onChooseFile.bind(this)
    })
  }

  onChooseFile (event: InputEvent): void {
    this.proxiesToImport = []
    this.importError = undefined
    const input = event.target as HTMLInputElement
    this.cleanUp = () => {
      input.value = ''
    }

    const files = input.files ?? []
    if (files.length === 0) {
      return
    }
    const file = files[0]

    if (file.size > 1000000) {
      this.importError = t('ImportPage_fileTooLargeError')
      m.redraw()
      return
    }
    const reader = new FileReader()
    reader.readAsText(file, 'UTF-8')
    reader.onload = (evt) => {
      try {
        const fileContents = evt.target?.result
        if (typeof fileContents !== 'string') {
          throw new Error('File could not be read as text')
        }
        const converter = new FoxyProxyConverter()
        this.proxiesToImport = converter.convert(JSON.parse(fileContents))
      } catch (e) {
        console.error('Failed to parse import file', e)
        this.proxiesToImport = []
        this.importError = t('ImportPage_invalidFileError')
      }
      m.redraw()
    }
    reader.onerror = (evt) => {
      console.error(evt)
      this.importError = t('ImportPage_invalidFileError')
      m.redraw()
    }
  }

  async doImport (): Promise<void> {
    for (const proxy of this.proxiesToImport) {
      // @ts-expect-error
      await this.store.putProxy(proxy)
    }

    m.route.set('/proxies')
    this.reset()
  }

  reset (): void {
    this.proxiesToImport = []
    this.importError = undefined
    if (this.cleanUp !== undefined) {
      this.cleanUp()
    }
    m.redraw()
  }

  view (): Vnode {
    let text = t('ImportPage_importButtonNoFileSelected')
    const canImport = this.proxiesToImport.length > 0
    if (canImport) {
      text = t('ImportPage_importButtonDoImport', this.proxiesToImport.length)
    }

    return m('section', [
      m('h2', t('ImportPage_heading')),
      m('form', [
        m(this.foxyProxyFileInput),
        this.importError !== undefined
          ? m('p.error', { role: 'alert' }, this.importError)
          : null,
        m('button.button.button--primary', {
          disabled: !canImport,
          onclick: async () => {
            await this.doImport()
          }
        }, text)
      ])
    ])
  }
}

class FileInput {
  id: string
  title: string
  onChange: (e: InputEvent) => void

  constructor ({ title, onChange }: { title: string, onChange: (e: InputEvent) => void }) {
    this.title = title
    this.id = uuidv4()
    this.onChange = onChange
  }

  view ({ attrs: { class: className = '' } }): Vnode {
    const inputClasses = ['input__field']

    // TODO Add error handling

    const topClasses = ['input', className]
    return m('div', { class: topClasses.join(' ') }, [
      m('label', { class: 'input__label', for: this.id }, this.title),
      m(
        'input',
        {
          id: this.id,
          type: 'file',
          class: inputClasses.join(' '),
          onchange: this.onChange
        }
      )
    ])
  }
}
