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
        this.itemHeights = [] // Массив реальных высот элементов
        this.cumulativeHeights = [] // Накопительные высоты для быстрого поиска
        this.viewBoxCache = new Map() // Кэш для viewBox данных SVG
        this.isScrolling = false // Флаг активного скролла
        this.scrollEndTimer = null // Таймер для определения конца скролла
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
        
        // Для мобильных устройств предварительно загружаем viewBox данные
        if (this.isMobile) {
            // Загружаем viewBox данные параллельно для всего батча
            const viewBoxPromises = batch.map(filename => this.getViewBoxData(filename))
            await Promise.all(viewBoxPromises)
        }
        
        // Создаем элементы параллельно, но не ждем загрузки изображений
        const promises = batch.map((filename, idx) => 
            this.createImageElement(filename, this.currentIndex + idx)
        )
        await Promise.all(promises)
        
        this.currentIndex = endIndex
        this.isLoading = false
        this.loader.style.display = 'none'
        
        document.getElementById('loadedCount').textContent = this.currentIndex
        
        // Обновляем накопительные высоты после добавления новых элементов
        if (this.isMobile) {
            this.updateCumulativeHeights()
        }
    }

    async createImageElement(filename, index) {
        if (this.isMobile) {
            // Получаем точные данные viewBox для правильной оценки высоты
            const viewBoxData = await this.getViewBoxData(filename)
            const estimatedHeight = this.estimateHeight(viewBoxData.aspectRatio)
            
            this.mobileItems[index] = {
                filename: filename,
                url: `${import.meta.env.BASE_URL}mathworld_svgs/${filename}`,
                loaded: false,
                element: null,
                height: estimatedHeight, // Точная оценка на основе viewBox
                aspectRatio: viewBoxData.aspectRatio,
                realHeight: null,
                heightCorrection: 0
            }
            
            // Создаём элемент только если он в видимом диапазоне
            if (index >= this.visibleRange.start && index <= this.visibleRange.end) {
                this.createMobileElement(index)
            }
            
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

    updateCumulativeHeights() {
        let cumulative = 0
        this.cumulativeHeights = []
        const gap = 15
        
        for (let i = 0; i < this.mobileItems.length; i++) {
            const item = this.mobileItems[i]
            if (item) {
                // Используем начальную оценку высоты (не меняем после загрузки)
                const height = item.height
                this.itemHeights[i] = height
                cumulative += height
                if (i > 0) cumulative += gap // Добавляем gap между элементами
                this.cumulativeHeights[i] = cumulative
            }
        }
    }
    
    estimateHeight(aspectRatio = 1) {
        // Оценка высоты на основе ширины контейнера и соотношения сторон
        const containerWidth = window.innerWidth - 20 // padding
        return Math.round(containerWidth * aspectRatio)
    }
    
    async getViewBoxData(filename) {
        // Проверяем кэш
        if (this.viewBoxCache.has(filename)) {
            return this.viewBoxCache.get(filename)
        }
        
        try {
            const url = `${import.meta.env.BASE_URL}mathworld_svgs/${filename}`
            const response = await fetch(url)
            const text = await response.text()
            
            // Парсим viewBox из SVG
            const viewBoxMatch = text.match(/viewBox=["']([^"']+)["']/i)
            if (viewBoxMatch) {
                const [x, y, width, height] = viewBoxMatch[1].split(/\s+/).map(Number)
                const aspectRatio = height / width
                
                // Сохраняем в кэш
                const data = { aspectRatio, width, height }
                this.viewBoxCache.set(filename, data)
                return data
            }
        } catch (error) {
            console.error(`Failed to load viewBox for ${filename}:`, error)
        }
        
        // Возвращаем дефолтное значение при ошибке
        const defaultData = { aspectRatio: 0.7, width: 100, height: 70 }
        this.viewBoxCache.set(filename, defaultData)
        return defaultData
    }
    
    findIndexAtScroll(scrollTop) {
        // Бинарный поиск индекса элемента по позиции скролла
        let left = 0
        let right = this.cumulativeHeights.length - 1
        
        while (left <= right) {
            const mid = Math.floor((left + right) / 2)
            const prevHeight = mid > 0 ? this.cumulativeHeights[mid - 1] : 0
            const currHeight = this.cumulativeHeights[mid]
            
            if (scrollTop >= prevHeight && scrollTop < currHeight) {
                return mid
            } else if (scrollTop < prevHeight) {
                right = mid - 1
            } else {
                left = mid + 1
            }
        }
        
        return Math.max(0, Math.min(left, this.cumulativeHeights.length - 1))
    }

    createMobileElement(index) {
        const item = this.mobileItems[index]
        if (!item || item.element) return
        
        const wrapper = document.createElement('div')
        wrapper.className = 'mobile-image-wrapper'
        wrapper.dataset.index = index
        
        // Устанавливаем минимальную высоту на основе оценки
        wrapper.style.minHeight = `${item.height}px`
        
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
            
            // Сохраняем реальную высоту и соотношение сторон
            const realHeight = wrapper.offsetHeight + 15 // реальная высота wrapper + gap
            item.realHeight = realHeight
            item.aspectRatio = img.naturalHeight / img.naturalWidth
            
            // НЕ обновляем cumulativeHeights чтобы избежать прыжков
            // Вместо этого сохраняем коррекцию для локального использования
            const estimatedHeight = item.height || this.estimateHeight(item.aspectRatio)
            item.heightCorrection = realHeight - estimatedHeight
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
    
    async updateMobileVisibility() {
        if (!this.isMobile || this.cumulativeHeights.length === 0) return
        
        const scrollTop = window.pageYOffset || document.documentElement.scrollTop
        const viewportHeight = window.innerHeight
        
        // Находим видимый диапазон на основе реальных высот
        const startIndex = this.findIndexAtScroll(Math.max(0, scrollTop - 500))
        const endIndex = this.findIndexAtScroll(scrollTop + viewportHeight + 500)
        
        const newStart = Math.max(0, startIndex - 5)
        const newEnd = Math.min(this.mobileItems.length - 1, endIndex + 5)
        
        // Предварительно загружаем viewBox для новых элементов
        const viewBoxPromises = []
        for (let i = newStart; i <= newEnd; i++) {
            if (this.mobileItems[i] && !this.mobileItems[i].element && !this.viewBoxCache.has(this.mobileItems[i].filename)) {
                viewBoxPromises.push(this.getViewBoxData(this.mobileItems[i].filename))
            }
        }
        if (viewBoxPromises.length > 0) {
            await Promise.all(viewBoxPromises)
        }
        
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
        
        // Обновляем высоты спейсеров только если не активный скролл
        if (this.topSpacer && this.bottomSpacer && !this.isScrolling) {
            const topHeight = newStart > 0 ? this.cumulativeHeights[newStart - 1] : 0
            const totalHeight = this.cumulativeHeights[this.cumulativeHeights.length - 1] || 0
            const bottomHeight = Math.max(0, totalHeight - (this.cumulativeHeights[newEnd] || 0))
            
            this.topSpacer.style.height = `${topHeight}px`
            this.bottomSpacer.style.height = `${bottomHeight}px`
        }
    }

    setupEventListeners() {
        // Оптимизированный скролл
        let ticking = false
        window.addEventListener('scroll', () => {
            // Устанавливаем флаг активного скролла
            this.isScrolling = true
            
            // Сбрасываем таймер конца скролла
            clearTimeout(this.scrollEndTimer)
            this.scrollEndTimer = setTimeout(() => {
                this.isScrolling = false
                // Обновляем спейсеры после окончания скролла
                if (this.isMobile) {
                    this.updateMobileVisibility()
                }
            }, 150)
            
            if (!ticking) {
                window.requestAnimationFrame(() => {
                    this.handleScroll()
                    ticking = false
                })
                ticking = true
            }
        }, { passive: true })
        
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