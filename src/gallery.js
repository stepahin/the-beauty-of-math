export class MasonryGallery {
    constructor(svgFiles) {
        this.svgFiles = svgFiles
        this.loadedImages = 0
        this.currentIndex = 0
        this.isMobile = window.innerWidth <= 768
        this.batchSize = this.isMobile ? 10 : 30 // Меньше батч для мобильных
        this.columns = []
        this.columnHeights = []
        this.isLoading = false
        this.visibleItems = new Set()
        this.observer = null
        this.mobileItems = [] // Храним все элементы для мобильных
        this.visibleRange = { start: 0, end: 50 } // Видимый диапазон
    }

    async init() {
        this.container = document.getElementById('masonryGrid')
        this.loader = document.getElementById('loader')
        
        document.getElementById('totalCount').textContent = this.svgFiles.length
        
        this.setupColumns()
        this.setupIntersectionObserver()
        this.setupLoaderAnimation()
        await this.loadBatch()
        this.setupEventListeners()
    }

    setupLoaderAnimation() {
        const indicator = this.loader.querySelector('.loading-indicator')
        if (!indicator) return
        
        const frames = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏']
        let frameIndex = 0
        
        this.loaderInterval = setInterval(() => {
            if (this.isLoading) {
                indicator.textContent = frames[frameIndex]
                frameIndex = (frameIndex + 1) % frames.length
            }
        }, 80)
    }

    setupColumns() {
        // Проверяем мобильное устройство
        this.isMobile = window.innerWidth <= 768
        
        if (this.isMobile) {
            // Для мобильных - простой контейнер со спейсерами
            this.container.className = 'mobile-container'
            this.container.innerHTML = ''
            
            // Верхний спейсер
            this.topSpacer = document.createElement('div')
            this.topSpacer.className = 'mobile-spacer'
            this.container.appendChild(this.topSpacer)
            
            // Контейнер для видимых элементов
            this.visibleContainer = document.createElement('div')
            this.visibleContainer.className = 'mobile-visible-container'
            this.container.appendChild(this.visibleContainer)
            
            // Нижний спейсер
            this.bottomSpacer = document.createElement('div')
            this.bottomSpacer.className = 'mobile-spacer'
            this.container.appendChild(this.bottomSpacer)
            
            return
        }
        
        // Для десктопа - оригинальная логика
        const containerWidth = this.container.offsetWidth
        let numColumns
        
        if (containerWidth >= 1800) {
            numColumns = 4
        } else if (containerWidth >= 1400) {
            numColumns = 3
        } else if (containerWidth >= 900) {
            numColumns = 2
        } else {
            numColumns = 1
        }
        
        this.container.innerHTML = ''
        this.container.className = 'masonry-grid'
        this.columns = []
        this.columnHeights = []
        
        for (let i = 0; i < numColumns; i++) {
            const column = document.createElement('div')
            column.className = 'masonry-column'
            this.container.appendChild(column)
            this.columns.push(column)
            this.columnHeights.push(0)
        }
    }

    setupIntersectionObserver() {
        // Для мобильных устройств отключаем виртуализацию
        if (this.isMobile) {
            return
        }
        
        // Полная виртуализация только для десктопа
        this.observer = new IntersectionObserver((entries) => {
            requestAnimationFrame(() => {
                entries.forEach(entry => {
                    const item = entry.target
                    const img = item.querySelector('img')
                    
                    if (entry.isIntersecting) {
                        // Элемент в области видимости - загружаем изображение
                        if (img && !img.src && img.dataset.src) {
                            img.src = img.dataset.src
                        }
                    } else {
                        // Элемент вне области видимости
                        // Проверяем, насколько далеко элемент от viewport
                        const rect = entry.boundingClientRect
                        const threshold = 2000 // Порог в пикселях
                        
                        if (rect.bottom < -threshold || rect.top > window.innerHeight + threshold) {
                            // Элемент далеко за пределами экрана - выгружаем изображение
                            if (img && img.src && img.complete) {
                                // Сохраняем URL перед выгрузкой
                                img.dataset.src = img.src
                                // Очищаем src для освобождения памяти
                                img.removeAttribute('src')
                                // Убираем класс загрузки
                                img.classList.remove('loaded')
                                // Добавляем placeholder обратно
                                if (!item.querySelector('.loading-placeholder')) {
                                    const placeholder = document.createElement('div')
                                    placeholder.className = 'loading-placeholder'
                                    item.insertBefore(placeholder, img)
                                }
                            }
                        }
                    }
                })
            })
        }, {
            rootMargin: '500px', // Область предзагрузки
            threshold: 0
        })
    }

    async loadBatch() {
        if (this.isLoading || this.currentIndex >= this.svgFiles.length) return
        
        this.isLoading = true
        this.loader.style.display = 'block'
        
        const endIndex = Math.min(this.currentIndex + this.batchSize, this.svgFiles.length)
        const batch = this.svgFiles.slice(this.currentIndex, endIndex)
        
        // Создаем элементы параллельно, но не ждем загрузки изображений
        const promises = batch.map((filename, idx) => 
            this.createImageElement(filename, this.currentIndex + idx)
        )
        await Promise.all(promises)
        
        this.currentIndex = endIndex
        this.isLoading = false
        this.loader.style.display = 'none'
        
        document.getElementById('loadedCount').textContent = this.currentIndex
    }

    createImageElement(filename, index) {
        return new Promise((resolve) => {
            if (this.isMobile) {
                // Сохраняем данные об элементе
                this.mobileItems[index] = {
                    filename: filename,
                    url: `${import.meta.env.BASE_URL}mathworld_svgs/${filename}`,
                    loaded: false,
                    element: null
                }
                
                // Создаём элемент только если он в видимом диапазоне
                if (index >= this.visibleRange.start && index <= this.visibleRange.end) {
                    this.createMobileElement(index)
                }
                
                resolve()
                return
            }
            
            // Десктопная версия остается без изменений
            const item = document.createElement('div')
            item.className = 'masonry-item'
            
            const placeholder = document.createElement('div')
            placeholder.className = 'loading-placeholder'
            item.appendChild(placeholder)
            
            const img = document.createElement('img')
            img.dataset.src = `${import.meta.env.BASE_URL}mathworld_svgs/${filename}`
            img.alt = filename
            img.loading = 'lazy'
            
            img.onload = () => {
                const placeholders = item.querySelectorAll('.loading-placeholder')
                placeholders.forEach(p => p.remove())
                img.classList.add('loaded')
                this.loadedImages++
                
                setTimeout(() => {
                    const columnIndex = Array.from(this.columns).findIndex(col => col.contains(item))
                    if (columnIndex !== -1) {
                        this.updateColumnHeight(columnIndex)
                    }
                }, 100)
            }
            
            img.onerror = () => {
                console.error(`Failed to load: ${filename}`)
                item.remove()
            }
            
            item.appendChild(img)
            
            const shortestColumnIndex = this.getShortestColumnIndex()
            this.columns[shortestColumnIndex].appendChild(item)
            
            if (this.observer) {
                this.observer.observe(item)
            }
            
            const rect = item.getBoundingClientRect()
            if (rect.bottom >= -500 && rect.top <= window.innerHeight + 500) {
                img.src = img.dataset.src
            }
            
            resolve()
        })
    }

    getShortestColumnIndex() {
        // Для мобильных возвращаем 0
        if (this.isMobile || !this.columns.length) return 0
        
        // Находим колонку с минимальной высотой
        let minHeight = this.columns[0].offsetHeight
        let minIndex = 0
        
        for (let i = 1; i < this.columns.length; i++) {
            const height = this.columns[i].offsetHeight
            if (height < minHeight) {
                minHeight = height
                minIndex = i
            }
        }
        
        return minIndex
    }
    
    updateColumnHeight(index) {
        if (this.columns[index]) {
            this.columnHeights[index] = this.columns[index].offsetHeight
        }
    }

    createMobileElement(index) {
        const item = this.mobileItems[index]
        if (!item || item.element) return
        
        const wrapper = document.createElement('div')
        wrapper.className = 'mobile-image-wrapper'
        wrapper.dataset.index = index
        
        const placeholder = document.createElement('div')
        placeholder.className = 'mobile-placeholder'
        wrapper.appendChild(placeholder)
        
        const img = document.createElement('img')
        img.src = item.url
        img.alt = item.filename
        img.className = 'mobile-image'
        img.style.display = 'none'
        
        img.onload = () => {
            this.loadedImages++
            item.loaded = true
            placeholder.style.display = 'none'
            img.style.display = 'block'
        }
        
        img.onerror = () => {
            console.error(`Failed to load: ${item.filename}`)
            wrapper.style.display = 'none'
        }
        
        wrapper.appendChild(img)
        item.element = wrapper
        
        // Вставляем в правильное место в видимом контейнере
        const nextIndex = this.findNextVisibleIndex(index)
        if (nextIndex !== -1) {
            const nextElement = this.mobileItems[nextIndex].element
            this.visibleContainer.insertBefore(wrapper, nextElement)
        } else {
            this.visibleContainer.appendChild(wrapper)
        }
    }
    
    findNextVisibleIndex(index) {
        for (let i = index + 1; i < this.mobileItems.length; i++) {
            if (this.mobileItems[i] && this.mobileItems[i].element) {
                return i
            }
        }
        return -1
    }
    
    updateMobileVisibility() {
        if (!this.isMobile) return
        
        const scrollTop = window.pageYOffset || document.documentElement.scrollTop
        const itemHeight = 215 // Приблизительная высота элемента с отступом
        
        // Расчитываем новый видимый диапазон
        const newStart = Math.max(0, Math.floor(scrollTop / itemHeight) - 10)
        const newEnd = Math.min(this.mobileItems.length - 1, Math.ceil((scrollTop + window.innerHeight * 2) / itemHeight) + 10)
        
        // Удаляем элементы вне диапазона
        for (let i = this.visibleRange.start; i < newStart; i++) {
            if (this.mobileItems[i] && this.mobileItems[i].element) {
                this.mobileItems[i].element.remove()
                this.mobileItems[i].element = null
            }
        }
        
        for (let i = newEnd + 1; i <= this.visibleRange.end; i++) {
            if (this.mobileItems[i] && this.mobileItems[i].element) {
                this.mobileItems[i].element.remove()
                this.mobileItems[i].element = null
            }
        }
        
        // Создаём новые элементы в диапазоне
        for (let i = newStart; i <= newEnd; i++) {
            if (this.mobileItems[i] && !this.mobileItems[i].element) {
                this.createMobileElement(i)
            }
        }
        
        this.visibleRange = { start: newStart, end: newEnd }
        
        // Обновляем высоты спейсеров
        if (this.topSpacer && this.bottomSpacer) {
            this.topSpacer.style.height = `${newStart * itemHeight}px`
            this.bottomSpacer.style.height = `${Math.max(0, (this.mobileItems.length - newEnd - 1) * itemHeight)}px`
        }
    }

    setupEventListeners() {
        // Оптимизированный скролл
        let ticking = false
        window.addEventListener('scroll', () => {
            if (!ticking) {
                window.requestAnimationFrame(() => {
                    this.handleScroll()
                    ticking = false
                })
                ticking = true
            }
        })
        
        // Ресайз окна
        let resizeTimeout
        window.addEventListener('resize', () => {
            clearTimeout(resizeTimeout)
            resizeTimeout = setTimeout(() => {
                const wasMobile = this.isMobile
                const isNowMobile = window.innerWidth <= 768
                
                if (wasMobile !== isNowMobile) {
                    // Перезагружаем страницу при смене режима
                    window.location.reload()
                } else if (!this.isMobile) {
                    const oldColumnCount = this.columns.length
                    this.setupColumns()
                    
                    if (oldColumnCount !== this.columns.length) {
                        this.redistributeItems()
                    }
                }
            }, 250)
        })
        
    }

    handleScroll() {
        const scrollTop = window.pageYOffset || document.documentElement.scrollTop
        const windowHeight = window.innerHeight
        const documentHeight = document.documentElement.scrollHeight
        
        // Обновляем видимость для мобильных
        if (this.isMobile) {
            this.updateMobileVisibility()
        }
        
        // Загружаем больше при приближении к низу
        const threshold = this.isMobile ? 500 : 1000 // Меньше порог для мобильных
        if (scrollTop + windowHeight >= documentHeight - threshold && !this.isLoading) {
            this.loadBatch()
        }
    }

    redistributeItems() {
        // На мобильных не перераспределяем
        if (this.isMobile) return
        
        const items = Array.from(this.container.querySelectorAll('.masonry-item'))
        
        this.columns.forEach(col => col.innerHTML = '')
        this.columnHeights.fill(0)
        
        items.forEach(item => {
            const shortestColumnIndex = this.getShortestColumnIndex()
            this.columns[shortestColumnIndex].appendChild(item)
            // Пересоздаем observer для элемента
            this.observer.observe(item)
        })
        
        // Проверяем видимость после перераспределения
        setTimeout(() => {
            items.forEach(item => {
                const rect = item.getBoundingClientRect()
                const img = item.querySelector('img')
                if (rect.bottom >= 0 && rect.top <= window.innerHeight && img && !img.src && img.dataset.src) {
                    img.src = img.dataset.src
                }
            })
        }, 100)
    }
}