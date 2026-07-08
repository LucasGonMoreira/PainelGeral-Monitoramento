const ZABBIX_CONFIG = {
    url: './zabbix_proxy.php'
};

// ==========================================
// CONFIGURAÇÃO DOS ITENS DO SERVIDOR
// ==========================================
// Caso queira adicionar mais itens ou alterar as chaves do Zabbix, faça aqui:
const SERVER_METRICS_CONFIG = {
    keys: {
        cpu: 'system.cpu.util',
        memory: 'vm.memory.utilization',
        disk: 'vfs.fs.size[/,pused]', // Ajuste a partição (ex: /, C:, /data)
        uptime: 'system.uptime',
        ping: 'agent.ping',
        image: 'custom.server.image' // Adicione aqui a key do Zabbix que contém a URL da imagem
    },
    // Rótulos exibidos na interface
    labels: {
        cpu: 'CPU',
        memory: 'Memória',
        disk: 'Armazenamento'
    }
};

// ==========================================
// CONFIGURAÇÃO DOS ITENS DO POP PROTECT
// ==========================================
// const POP_METRICS_CONFIG = {
//     keys: {
//         status: 'system.cpu.util',
//         voltagem: 'vm.memory.utilization',
//         temperatura: 'vfs.fs.size[/,pused]', // Ajuste a partição (ex: /, C:, /data)
//         ping: 'agent.ping',
//         image: 'image.key' // Adicione aqui a key do Zabbix que contém a URL da imagem
//     },
//     labels: {
//         status: 'Status AC',
//         voltagem: 'Voltagem',
//         temperatura: 'Temperatura'
//     }
// };



// Estrutura global da aplicação onde as triggers reais serÃ£o guardadas
const zabbixApiData = { cities: [] };

const app = {
    availabilityData: null,
    currentCityId: null,
    currentTowerId: null,
    currentEquipmentId: null,

    async init() {
        this.bindEvents();
        this.startClock();

        // Tenta sincronizar com o Zabbix real
        await this.syncZabbixLoop();

        // Atualiza a cada 30 segundos
        setInterval(() => this.syncZabbixLoop(), 30000);
    },

    bindEvents() {
        const btnBackCities = document.getElementById('btn-back-cities');
        if (btnBackCities) btnBackCities.addEventListener('click', () => this.openCitiesView());

        const btnBackTowers = document.getElementById('btn-back-towers');
        if (btnBackTowers) btnBackTowers.addEventListener('click', () => this.openTowersView(this.currentCityId));

        const btnBackEquipments = document.getElementById('btn-back-equipments');
        if (btnBackEquipments) btnBackEquipments.addEventListener('click', () => this.openEquipmentsView(this.currentTowerId));

        const btnCloseComment = document.getElementById('close-comment-btn');
        if (btnCloseComment) {
            btnCloseComment.addEventListener('click', () => {
                document.getElementById('comment-modal').style.display = 'none';
            });
        }
    },

    startClock() {
        const update = () => {
            const now = new Date();
            document.getElementById('clock').innerText = now.toLocaleTimeString('pt-BR');
        };
        setInterval(update, 1000);
        update();
    },

    // ==========================================
    // INTEGRAÇÃO ZABBIX API REAL (JSON-RPC)
    // ==========================================

    async rpcCall(method, params, id = 1) {
        if (!ZABBIX_CONFIG.url || ZABBIX_CONFIG.url.includes('seuprovedor')) {
            console.warn("ZABBIX API URL nÃ£o configurada. Mostrando dados vazios.");
            return { error: 'URL Default' };
        }

        const payload = {
            jsonrpc: "2.0",
            method: method,
            params: params,
            id: id
            // Auth nÃ£o existe no Front-End! O zabbix_proxy.php vai injetar.
        };

        const fetchUrl = ZABBIX_CONFIG.url;

        try {
            const response = await fetch(fetchUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            const data = await response.json();
            if (data.error) {
                console.error("Zabbix API Error:", data.error);
                return { error: data.error };
            }
            return data.result;
        } catch (error) {
            console.error("Network Error Calling Zabbix:", error);
            return { error: "Network/CORS Error" };
        }
    },

    async syncZabbixLoop() {
        console.log("Buscando daddos do Zabbix através do Proxy PHP...");

        // 1. Pega todos os hosts
        const hosts = await this.rpcCall('host.get', {
            output: ['hostid', 'host', 'name'], selectInterfaces: ['ip'],
            selectGroups: ['name'],
            filter: { status: 0 } // Apenas enabled
        });

        if (!hosts || hosts.error) {
            console.error("Erro no Zabbix:", hosts?.error);
            console.warn("Live Server detectado ou conexão falhou. Usando dados fictícios para visualização da interface...");

            // Dados Mockados para visualização no Live Server
            const mockHosts = [
                { hostid: "2", name: "OLT Matriz", groups: [{ name: "Cajazeiras" }, { name: "Cajazeiras - Torre Matriz" }] },
                { hostid: "3", name: "Switch Core", groups: [{ name: "Sousa" }, { name: "Sousa - Torre Centro" }] },
                { hostid: "4", name: "Rádio Enlace", groups: [{ name: "Pombal" }, { name: "Pombal - Torre Sul" }] },
                { hostid: "5", name: "IXC-PRIMARIO", groups: [{ name: "Cajazeiras" }, { name: "Cajazeiras - Torre Matriz" }, { name: "Zabbix7 / Servidores" }], interfaces: [{ ip: "172.16.0.10" }], metrics: { cpu: 15, memory: 45, disk: 30, uptime: 86400, online: true, image: 'https://via.placeholder.com/100' } },
                { hostid: "6", name: "SRV-MONITORAMENTO", groups: [{ name: "Sousa" }, { name: "Sousa - Torre Centro" }, { name: "Zabbix7 / Servidores" }], interfaces: [{ ip: "172.16.0.20" }], metrics: { cpu: 85, memory: 92, disk: 45, uptime: 1572480, online: true, image: 'https://via.placeholder.com/100' } },
                { hostid: "7", name: "SRV-BACKUP", groups: [{ name: "Pombal" }, { name: "Pombal - Torre Sul" }, { name: "Zabbix7 / Servidores" }], interfaces: [{ ip: "172.16.0.30" }], metrics: { cpu: 12, memory: 34, disk: 88, uptime: 2592000, online: true, image: 'https://via.placeholder.com/100' } },
                { hostid: "8", name: "POP-01-MATRIZ", groups: [{ name: "Cajazeiras" }, { name: "Cajazeiras - Torre Matriz" }, { name: "POP-PROTECT" }], interfaces: [{ ip: "172.16.10.1" }], metrics: { status: 100, voltagem: 48, temperatura: 25, online: true, image: 'https://via.placeholder.com/100', uptime: 1209600 } }
            ];

            const mockTriggers = [
                { triggerid: "100", description: "Cabo de Fibra Rompido", priority: "0", hosts: [{ hostid: "1" }], eventCount30d: 1, lastEvent: [{ acknowledged: "0" }] },
                { triggerid: "101", description: "Latência Alta no Roteador", priority: "4", hosts: [{ hostid: "1" }], eventCount30d: 5, lastEvent: [{ acknowledged: "0" }] },
                { triggerid: "102", description: "Bateria Fraca OLT", priority: "2", hosts: [{ hostid: "2" }], eventCount30d: 2, lastEvent: [{ acknowledged: "1" }] },
                { triggerid: "103", description: "Trafego Anormal", priority: "2", hosts: [{ hostid: "4" }], eventCount30d: 12, lastEvent: [{ acknowledged: "0" }] },
                { triggerid: "104", description: "Uso de CPU Elevado", priority: "2", hosts: [{ hostid: "6" }], eventCount30d: 3, lastEvent: [{ acknowledged: "0" }] }
            ];

            this.processZabbixData(mockHosts, mockTriggers);

            if (document.getElementById('cities-view').classList.contains('active')) {
                this.renderCities();
            } else if (document.getElementById('towers-view').classList.contains('active')) {
                this.renderTowers(this.currentCityId);
            } else if (document.getElementById('equipments-view').classList.contains('active')) {
                this.renderEquipments(this.currentTowerId);
            } else if (document.getElementById('alerts-view').classList.contains('active')) {
                this.renderAlerts(this.currentEquipmentId);
            }
            return;
        }

        // 2. Pega as triggers ativas com alertas
        const triggers = await this.rpcCall('trigger.get', {
            output: ['triggerid', 'description', 'priority', 'value'],
            selectHosts: ['hostid'],
            selectLastEvent: 'extend',
            filter: { value: 1 },         // value 1 = PROBLEM
            active: 1,                    // belongs to active host
            skipDependent: 1,             // ignora falhas derivadas se a raiz ta com erro
            expandDescription: 1          // Nome real do item resolvida pelas macros
            // Removido min_severity: 2 para permitir a prioridade 0 (Não Identificado / Crítico)
        });

        if (triggers && !triggers.error && triggers.length > 0) {
            const triggerIds = triggers.map(t => t.triggerid);
            const timeFrom = Math.floor(Date.now() / 1000) - (30 * 24 * 60 * 60);

            const events = await this.rpcCall('event.get', {
                output: ['objectid'],
                objectids: triggerIds,
                time_from: timeFrom,
                value: 1 // Apenas quando foi a status PROBLEM
            });

            const eventCounts = {};
            if (events && !events.error) {
                events.forEach(e => {
                    eventCounts[e.objectid] = (eventCounts[e.objectid] || 0) + 1;
                });
            }

            const activeEventIds = triggers.map(t => {
                if (t.lastEvent && t.lastEvent.eventid) return t.lastEvent.eventid;
                if (Array.isArray(t.lastEvent) && t.lastEvent[0] && t.lastEvent[0].eventid) return t.lastEvent[0].eventid;
                return null;
            }).filter(id => id !== null);

            let ackMap = {};
            if (activeEventIds.length > 0) {
                const activeEvents = await this.rpcCall('event.get', {
                    output: 'extend',
                    eventids: activeEventIds,
                    select_acknowledges: 'extend'
                });
                if (activeEvents && !activeEvents.error) {
                    activeEvents.forEach(e => {
                        const acks = e.acknowledges || e.acknowledgments || [];
                        if (acks.length > 0) {
                            // Encontrar o último comentário nÃ£o vazio no histÃ³rico deste evento
                            let lastWithMsg = [...acks].reverse().find(a => a.message && a.message.trim() !== "");
                            const lastAck = lastWithMsg || acks[acks.length - 1];

                            const name = lastAck.name || "";
                            const surname = lastAck.surname || "";
                            const alias = lastAck.alias || lastAck.username || "";
                            let displayUser = alias || "Usuario";

                            if (name || surname) {
                                displayUser = `${alias}`.replace(/\s+/g, " ").trim();
                            }

                            ackMap[e.eventid] = `${displayUser}: ${lastAck.message || "Sem mensagem"}`;
                        }
                    });
                }
            }

            triggers.forEach(tr => {
                tr.eventCount30d = eventCounts[tr.triggerid] || 1;

                let eId = null;
                if (tr.lastEvent && tr.lastEvent.eventid) eId = tr.lastEvent.eventid;
                else if (Array.isArray(tr.lastEvent) && tr.lastEvent[0] && tr.lastEvent[0].eventid) eId = tr.lastEvent[0].eventid;

                tr.ackMessage = eId && ackMap[eId] ? ackMap[eId] : '';
            });
        }


        // 3. Busca métricas para hosts que sÃ£o Servidores
        const serverHosts = hosts.filter(h =>
            h.groups && h.groups.some(g => g.name.toLowerCase().includes('servidores'))
        );

        if (serverHosts.length > 0) {
            const serverHostIds = serverHosts.map(h => h.hostid);
            try {
                // Busca as chaves configuradas em SERVER_METRICS_CONFIG
                const metricKeys = Object.values(SERVER_METRICS_CONFIG.keys);
                const items = await this.rpcCall('item.get', {
                    output: ['hostid', 'key_', 'lastvalue'],
                    hostids: serverHostIds,
                    search: {
                        key_: metricKeys
                    },
                    searchByAny: true,
                    searchWildcardsEnabled: true
                });

                if (items && !items.error) {
                    const metricsMap = {};
                    const cfg = SERVER_METRICS_CONFIG.keys;

                    items.forEach(it => {
                        if (!metricsMap[it.hostid]) {
                            metricsMap[it.hostid] = { cpu: 0, memory: 0, disk: 0, uptime: 0, online: true, image: null };
                        }

                        const val = it.lastvalue;
                        const key = it.key_;

                        const setMetric = (metricName, isFloat = true) => {
                            if (isFloat) {
                                const n = parseFloat(val);
                                metricsMap[it.hostid][metricName] = isNaN(n) ? 0 : n.toFixed(0);
                            } else {
                                metricsMap[it.hostid][metricName] = val;
                            }
                        };

                        if (key.includes(cfg.cpu)) setMetric('cpu');
                        else if (key.includes(cfg.memory)) setMetric('memory');
                        else if (key.includes(cfg.disk)) setMetric('disk');
                        else if (key.includes(cfg.uptime)) metricsMap[it.hostid].uptime = parseInt(val) || 0;
                        else if (key.includes(cfg.ping)) metricsMap[it.hostid].online = parseInt(val) === 1;
                        else if (key.includes(cfg.image)) setMetric('image', false);
                    });

                    hosts.forEach(h => {
                        if (metricsMap[h.hostid]) h.metrics = metricsMap[h.hostid];
                    });
                }
            } catch (e) { console.error("Erro ao buscar métricas:", e); }
        }

        // 4. Busca métricas para hosts que são POP PROTECT
        const popProtectHosts = hosts.filter(h =>
            h.groups && h.groups.some(g => g.name.toUpperCase().includes('POP-PROTECT'))
        );

        if (popProtectHosts.length > 0) {
            const popHostIds = popProtectHosts.map(h => h.hostid);
            try {
                const metricKeys = Object.values(POP_METRICS_CONFIG.keys);
                const items = await this.rpcCall('item.get', {
                    output: ['hostid', 'key_', 'lastvalue'],
                    hostids: popHostIds,
                    search: { key_: metricKeys },
                    searchByAny: true,
                    searchWildcardsEnabled: true
                });

                if (items && !items.error) {
                    const metricsMap = {};
                    const cfg = POP_METRICS_CONFIG.keys;

                    items.forEach(it => {
                        if (!metricsMap[it.hostid]) {
                            metricsMap[it.hostid] = { status: 0, voltagem: 0, temperatura: 0, online: true, image: null };
                        }
                        const val = it.lastvalue;
                        const key = it.key_;

                        const setMetric = (metricName, isFloat = true) => {
                            if (isFloat) {
                                const n = parseFloat(val);
                                metricsMap[it.hostid][metricName] = isNaN(n) ? 0 : n.toFixed(0);
                            } else {
                                metricsMap[it.hostid][metricName] = val;
                            }
                        };

                        if (key.includes(cfg.status)) setMetric('status');
                        else if (key.includes(cfg.voltagem)) setMetric('voltagem');
                        else if (key.includes(cfg.temperatura)) setMetric('temperatura');
                        else if (key.includes(cfg.ping)) metricsMap[it.hostid].online = parseInt(val) === 1;
                        else if (key.includes(cfg.image)) setMetric('image', false);
                    });

                    hosts.forEach(h => {
                        if (metricsMap[h.hostid]) h.metrics = metricsMap[h.hostid];
                    });
                }
            } catch (e) { console.error("Erro ao buscar métricas POP:", e); }
        }

        this.processZabbixData(hosts, triggers);

        this.reRenderCurrentView();

        // Busca disponibilidade global em background para atualizar os cards
        this.fetchGlobalAvailability().then(() => {
            this.reRenderCurrentView();
        }).catch(err => console.error("Erro na busca de disponibilidade global:", err));
    },

    reRenderCurrentView() {
        if (document.getElementById('cities-view').classList.contains('active')) {
            this.renderCities();
        } else if (document.getElementById('towers-view').classList.contains('active')) {
            this.renderTowers(this.currentCityId);
        } else if (document.getElementById('equipments-view').classList.contains('active')) {
            this.renderEquipments(this.currentTowerId);
        } else if (document.getElementById('alerts-view').classList.contains('active')) {
            this.renderAlerts(this.currentEquipmentId);
        }
    },

    processZabbixData(hostsArray, triggersArray) {
        // Zera estrutura
        zabbixApiData.cities = [];

        // 1. Mapear Hosts (Equipamentos)
        let hostMap = {};
        hostsArray.forEach(h => {
            let locations = [];

            if (h.groups && h.groups.length > 0) {
                // Filtrar grupos indesejados: Zabbix7 e Teste
                const validGroups = h.groups.filter(g => {
                    const upperName = (g.name || "").toUpperCase();
                    if (upperName.includes('ZABBIX7') && !upperName.includes('SERVIDORES')) return false;
                    if (upperName.includes('TESTE')) return false;
                    if (upperName.includes('DISCOVERED')) return false;
                    if (upperName.includes('GLOBAL')) return false;
                    if (upperName.includes('DOWNDETECTOR')) return false;
                    if (upperName.includes('MIMOSA')) return false;
                    if (upperName.includes('OLTS')) return false;
                    return true;
                });

                if (validGroups.length > 0) {
                    // Procurar TODOS os grupos vÃ¡lidos que tÃªm " - "
                    const towerGroups = validGroups.filter(g => g.name.includes(' - '));

                    if (towerGroups.length > 0) {
                        towerGroups.forEach(tg => {
                            locations.push({
                                popName: tg.name, // ex: "Marizopolis - torre 1"
                                cityName: tg.name.split(' - ')[0].trim() // ex: "Marizopolis"
                            });
                        });
                    } else {
                        // Se nÃ£o tiver hÃ­fen, usa o primeiro grupo vÃ¡lido como cidade
                        locations.push({
                            cityName: validGroups[0].name,
                            popName: validGroups[0].name + ' - Principal'
                        });
                    }
                }
            }

            // Ignorar host se nÃ£o sobrou nenhuma localizaÃ§Ã£o/grupo vÃ¡lido para ele
            if (locations.length === 0) return;

            hostMap[h.hostid] = {
                id: h.hostid,
                name: h.name,
                ip: h.interfaces && h.interfaces[0] ? h.interfaces[0].ip : '0.0.0.0',
                isServer: h.groups.some(g => g.name.toLowerCase().includes('servidores')),
                isPopProtect: h.groups && h.groups.some(g => (g.name || "").toUpperCase().trim().includes('POP-PROTECT')) || (h.name && h.name.toUpperCase().includes('POP -')),
                metrics: h.metrics || null,
                locations: locations,
                maxSeverity: 'ok',
                alerts: []
            };
        });

        // 2. Associar Triggers (Alertas) aos Equipamentos
        if (triggersArray && !triggersArray.error) {
            triggersArray.forEach(tr => {
                // Ignorar alertas da categoria "INFORMAÇÃO" (Prioridade 1)
                if (parseInt(tr.priority) === 1) return;

                const hostId = tr.hosts[0].hostid;
                if (!hostMap[hostId]) return;

                let sevDesc = 'attention'; // Por padrÃ£o, se for 1, 2, 3 vai pra amarelo (attention)

                if (parseInt(tr.priority) >= 4) {
                    sevDesc = 'disaster'; // Vermelho
                } else if (parseInt(tr.priority) === 0) {
                    sevDesc = 'critical'; // Roxo
                }

                if (sevDesc === 'critical') hostMap[hostId].maxSeverity = 'critical';
                if (sevDesc === 'disaster' && hostMap[hostId].maxSeverity !== 'critical') hostMap[hostId].maxSeverity = 'disaster';
                if (sevDesc === 'attention' && (hostMap[hostId].maxSeverity === 'ok')) hostMap[hostId].maxSeverity = 'attention';

                const isAck = tr.lastEvent && (tr.lastEvent.acknowledged == 1 || (Array.isArray(tr.lastEvent) && tr.lastEvent[0] && tr.lastEvent[0].acknowledged == 1));

                hostMap[hostId].alerts.push({
                    id: tr.triggerid,
                    name: tr.description,
                    status: sevDesc,
                    error: `Prioridade ${tr.priority}`,
                    eventCount30d: tr.eventCount30d || 1,
                    acknowledged: isAck,
                    ackMessage: tr.ackMessage || ''
                });
            });
        }

        // 3. Agrupar em Cidades -> POPs -> Equipamentos -> Alertas
        let citiesMap = {};

        Object.values(hostMap).forEach(h => {
            h.locations.forEach(loc => {
                if (!citiesMap[loc.cityName]) {
                    citiesMap[loc.cityName] = {
                        id: 'city_' + loc.cityName.replace(/\s/g, ''),
                        name: loc.cityName,
                        status: 'ok',
                        pops: {}
                    };
                }

                let popKey = loc.popName;
                let city = citiesMap[loc.cityName];

                if (!city.pops[popKey]) {
                    city.pops[popKey] = {
                        id: 'pop_' + loc.popName.replace(/[^a-zA-Z0-9]/g, ''),
                        name: loc.popName,
                        status: 'ok',
                        equipments: []
                    };
                }

                let pop = city.pops[popKey];

                // Propaga severity
                // A ordem de prioridade para a cor do bloco pai é: critical (roxo) > disaster (vermelho) > attention (amarelo) > ok
                if (h.maxSeverity === 'critical') {
                    pop.status = 'critical';
                    city.status = 'critical';
                } else if (h.maxSeverity === 'disaster') {
                    if (pop.status !== 'critical') pop.status = 'disaster';
                    if (city.status !== 'critical') city.status = 'disaster';
                } else if (h.maxSeverity === 'attention') {
                    if (pop.status === 'ok') pop.status = 'attention';
                    if (city.status === 'ok') city.status = 'attention';
                }

                pop.equipments.push({
                    id: h.id,
                    name: h.name,
                    ip: h.ip,
                    isServer: h.isServer,
                    isPopProtect: h.isPopProtect,
                    metrics: h.metrics,
                    status: h.maxSeverity,
                    alerts: h.alerts
                });

            });
        });

        // Converter objetos pops em arrays e calcular status de reconhecimento (ack) em cascata
        Object.values(citiesMap).forEach(city => {
            city.towers = Object.values(city.pops);
            delete city.pops;

            let cityUnackCount = 0;
            let cityAlertCount = 0;
            let cityAckUsers = new Set();

            city.towers.forEach(tower => {
                let towerUnackCount = 0;
                let towerAlertCount = 0;
                let towerAckUsers = new Set();

                if (tower.equipments) {
                    tower.equipments.forEach(eq => {
                        let eqUnackCount = 0;
                        let eqAlertCount = eq.alerts ? eq.alerts.length : 0;
                        let eqAckUsers = new Set();

                        if (eq.alerts) {
                            eq.alerts.forEach(al => {
                                if (!al.acknowledged) eqUnackCount++;
                                else if (al.ackMessage) {
                                    const u = al.ackMessage.split(':')[0].trim();
                                    if (u) eqAckUsers.add(u);
                                }
                            });
                        }

                        eq.isAck = (eqAlertCount > 0 && eqUnackCount === 0);
                        eq.ackUsers = Array.from(eqAckUsers).join(', ');

                        towerUnackCount += eqUnackCount;
                        towerAlertCount += eqAlertCount;
                        eqAckUsers.forEach(u => towerAckUsers.add(u));
                    });
                }

                tower.isAck = (towerAlertCount > 0 && towerUnackCount === 0);
                tower.ackUsers = Array.from(towerAckUsers).join(', ');

                cityUnackCount += towerUnackCount;
                cityAlertCount += towerAlertCount;
                towerAckUsers.forEach(u => cityAckUsers.add(u));
            });

            city.isAck = (cityAlertCount > 0 && cityUnackCount === 0);
            city.ackUsers = Array.from(cityAckUsers).join(', ');
        });

        zabbixApiData.cities = Object.values(citiesMap);

        // Ordenar alfabeticamente cidades, torres, equipamentos e alertas
        const sortPtBr = (a, b) => {
            const nameA = (a.name || "").trim();
            const nameB = (b.name || "").trim();
            return nameA.localeCompare(nameB, 'pt-BR', { sensitivity: 'base' });
        };

        zabbixApiData.cities.sort(sortPtBr);
        zabbixApiData.cities.forEach(city => {
            if (city.towers) {
                city.towers.sort(sortPtBr);
                city.towers.forEach(tower => {
                    if (tower.equipments) {
                        tower.equipments.sort(sortPtBr);
                        tower.equipments.forEach(eq => {
                            if (eq.alerts) {
                                eq.alerts.sort(sortPtBr);
                            }
                        });
                    }
                });
            }
        });

        console.log("Dados Zabbix Mapeados (4 Níveis): ", zabbixApiData);
    },

    // ==========================================
    // UI METHODS ORIGINAIS DO DASHBOARD
    // ==========================================

    hideAllViews() {
        document.querySelectorAll('.view-container').forEach(el => el.classList.remove('active'));
    },

    openCitiesView(filterStatus) {
        if (filterStatus !== undefined) {
            this.currentFilter = filterStatus; // Armazena apenas se foi clicado na Home
        }
        this.hideAllViews();
        document.getElementById('cities-view').classList.add('active');
        this.renderCities();
    },

    openTowersView(cityId) {
        this.currentCityId = cityId;
        this.hideAllViews();
        document.getElementById('towers-view').classList.add('active');

        const city = zabbixApiData.cities.find(c => c.id === cityId);
        if (city) {
            document.getElementById('towers-view-title').innerText = `Torres - ${city.name}`;
        }
        this.renderTowers(cityId);
    },

    openEquipmentsView(towerId) {
        this.currentTowerId = towerId;
        this.hideAllViews();
        document.getElementById('equipments-view').classList.add('active');

        let towerName = 'Equipamentos';
        if (this.currentCityId) {
            const city = zabbixApiData.cities.find(c => c.id === this.currentCityId);
            if (city) {
                const tower = city.towers.find(t => t.id === towerId);
                if (tower) towerName = tower.name;
            }
        }
        document.getElementById('equipments-view-title').innerText = `Equipamentos - ${towerName}`;
        this.renderEquipments(towerId);
    },

    openAlertsView(equipmentId) {
        this.currentEquipmentId = equipmentId;
        this.hideAllViews();
        document.getElementById('alerts-view').classList.add('active');

        let eqName = 'Alertas';
        if (this.currentCityId && this.currentTowerId) {
            const city = zabbixApiData.cities.find(c => c.id === this.currentCityId);
            if (city) {
                const tower = city.towers.find(t => t.id === this.currentTowerId);
                if (tower) {
                    const eq = tower.equipments.find(e => e.id === equipmentId);
                    if (eq) eqName = eq.name;
                }
            }
        }
        document.getElementById('alerts-view-title').innerText = `Alertas - ${eqName}`;
        this.renderServerStats(equipmentId);
        this.renderAlerts(equipmentId);
    },

    generateEntityCardHTML(id, name, statusCounts, subtext = '', isAck = false, ackMessage = '', showComment = false) {
        // Agora o statusCounts tem { total, unack } para cada prioridade
        const purpleActive = statusCounts.critical.unack > 0 ? 'active' : '';
        const redActive = statusCounts.disaster.unack > 0 ? 'active' : '';
        const yellowActive = statusCounts.attention.unack > 0 ? 'active' : '';

        // Verde ativo apenas se todos os alertas forem reconhecidos ou não houver alertas
        const totalAlerts = statusCounts.critical.total + statusCounts.disaster.total + statusCounts.attention.total;
        const totalUnack = statusCounts.critical.unack + statusCounts.disaster.unack + statusCounts.attention.unack;
        const greenActive = (totalAlerts > 0 && totalUnack === 0) || totalAlerts === 0 ? 'active' : '';

        let availStr = '';
        if (app.availabilityData) {
            let avail = null;
            if (id.startsWith('city_') && app.availabilityData.cities[id] !== undefined) avail = app.availabilityData.cities[id];
            else if (id.startsWith('pop_') && app.availabilityData.towers[id] !== undefined) avail = app.availabilityData.towers[id];
            else if (app.availabilityData.equipments[id] !== undefined) avail = app.availabilityData.equipments[id];

            if (avail !== null) {
                const formatted = avail.toFixed(2).replace('.', ',');
                let color = '#2ecc71';
                if (avail < 67) color = '#e74c3c';
                else if (avail < 87) color = '#f39c12';
                availStr = `<div style="font-size: 0.85rem; margin: 4px 0; color: ${color}; font-weight: 600;">Disp: ${formatted}%</div>`;
            }
        }

        const getIndicatorContent = (countObj) => {
            if (countObj.total > 0) {
                const unack = countObj.unack;
                const ack = countObj.total - unack;

                if (ack === 0) {
                    // Nenhum alerta reconhecido, mostra apenas o número sem o ícone
                    return `${unack}`;
                }

                // Há alertas reconhecidos, monta o texto e o ícone
                let text = '';
                if (unack === 0) text = `${ack}`;
                else text = `${unack}/${ack}`;

                let tooltip = '';
                if (ackMessage) {
                    const userName = ackMessage.split(':')[0].trim();
                    tooltip = `<span class="custom-tooltip">Reconhecido por: ${userName}</span>`;
                }
                return `${text} <div class="custom-tooltip-container" style="display:inline-flex; align-items:center; position:relative; margin-left:4px;">
                    <img src="manutencao.png" width="16" height="16" alt="Ack" style="position:relative; top:1px;">
                    ${tooltip}
                </div>`;
            }
            return '';
        };

        const checkSvg = `
            <div class="custom-tooltip-container" style="display: flex; align-items: center; justify-content: center; width: 100%; height: 100%;">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
            </div>`;

        let commentIcon = '';
        if (showComment && ackMessage) {
            commentIcon = `
            <div class="comment-icon" data-comment="${ackMessage.replace(/"/g, '&quot;')}" title="Ver Comentário Completo">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
                </svg>
            </div>`;
        }

        return `
            <div class="entity-card ${isAck ? 'is-acknowledged' : ''}" data-id="${id}">
                <div class="entity-indicators">
                    <div class="indicator purple ${purpleActive}">${getIndicatorContent(statusCounts.critical)}</div>
                    <div class="indicator red ${redActive}">${getIndicatorContent(statusCounts.disaster)}</div>
                    <div class="indicator yellow ${yellowActive}">${getIndicatorContent(statusCounts.attention)}</div>
                    <div class="indicator green ${greenActive}">${greenActive ? checkSvg : ''}</div>
                </div>
                <div class="entity-name">
                    <div style="display: flex; align-items: center; justify-content: center; position: relative; width: 100%;">
                        <span>${name}</span>
                        ${commentIcon}
                    </div>
                    ${availStr}
                    ${subtext ? `<span class="entity-subtext">${subtext}</span>` : ''}
                </div>
            </div>
        `;
    },

    countStatuses(items) {
        let counts = {
            critical: { total: 0, unack: 0 },
            disaster: { total: 0, unack: 0 },
            attention: { total: 0, unack: 0 },
            ok: { total: 0, unack: 0 }
        };
        if (!items) return counts;
        items.forEach(i => {
            if (counts[i.status] !== undefined) {
                counts[i.status].total++;
                if (!i.acknowledged) counts[i.status].unack++;
            } else {
                counts.ok.total++;
            }
        });
        return counts;
    },

    renderCities() {
        const grid = document.getElementById('cities-grid');
        let htmlChunks = [];

        let citiesToRender = [...zabbixApiData.cities];

        // Garantia de ordenação alfabética no momento da renderização
        citiesToRender.sort((a, b) => {
            const nameA = String(a.name || "").trim();
            const nameB = String(b.name || "").trim();
            return nameA.localeCompare(nameB, 'pt-BR', { sensitivity: 'base' });
        });

        if (this.currentFilter) {
            citiesToRender = citiesToRender.filter(c => c.status === this.currentFilter || (this.currentFilter === 'ok' && c.status === 'ok'));
        }

        citiesToRender.forEach(city => {
            let statusCounts = {
                critical: { total: 0, unack: 0 },
                disaster: { total: 0, unack: 0 },
                attention: { total: 0, unack: 0 },
                ok: { total: 0, unack: 0 }
            };
            let hasAlerts = false;
            if (city.towers) {
                city.towers.forEach(t => {
                    if (t.equipments) {
                        t.equipments.forEach(eq => {
                            if (eq.alerts) {
                                eq.alerts.forEach(al => {
                                    if (statusCounts[al.status] !== undefined) {
                                        statusCounts[al.status].total++;
                                        if (!al.acknowledged) statusCounts[al.status].unack++;
                                    }
                                    hasAlerts = true;
                                });
                            }
                        });
                    }
                });
            }
            if (!hasAlerts) statusCounts.ok.total = 1;

            htmlChunks.push(this.generateEntityCardHTML(city.id, city.name, statusCounts, `${city.towers ? city.towers.length : 0} Torre(s)`, city.isAck, city.ackUsers, false));
        });

        if (htmlChunks.length === 0) {
            htmlChunks.push('<div class="empty-message">Nenhuma cidade encontrada com este status.</div>');
        }

        grid.innerHTML = htmlChunks.join('');

        // Attach click events
        grid.querySelectorAll('.entity-card').forEach(card => {
            card.addEventListener('click', () => {
                this.openTowersView(card.getAttribute('data-id'));
            });
        });
    },

    renderTowers(cityId) {
        const grid = document.getElementById('towers-grid');
        let htmlChunks = [];

        const city = zabbixApiData.cities.find(c => c.id === cityId);

        if (city && city.towers) {
            city.towers.forEach(tower => {
                let statusCounts = {
                    critical: { total: 0, unack: 0 },
                    disaster: { total: 0, unack: 0 },
                    attention: { total: 0, unack: 0 },
                    ok: { total: 0, unack: 0 }
                };
                let hasAlerts = false;
                if (tower.equipments) {
                    tower.equipments.forEach(eq => {
                        if (eq.alerts) {
                            eq.alerts.forEach(al => {
                                if (statusCounts[al.status] !== undefined) {
                                    statusCounts[al.status].total++;
                                    if (!al.acknowledged) statusCounts[al.status].unack++;
                                }
                                hasAlerts = true;
                            });
                        }
                    });
                }
                if (!hasAlerts) statusCounts.ok.total = 1;

                htmlChunks.push(this.generateEntityCardHTML(tower.id, tower.name, statusCounts, `${tower.equipments ? tower.equipments.length : 0} Equipamento(s)`, tower.isAck, tower.ackUsers, false));
            });
        }


        if (htmlChunks.length === 0) {
            htmlChunks.push('<div class="empty-message">Nenhuma torre mapeada nesta cidade.</div>');
        }

        grid.innerHTML = htmlChunks.join('');

        grid.querySelectorAll('.entity-card').forEach(card => {
            card.addEventListener('click', () => {
                this.openEquipmentsView(card.getAttribute('data-id'));
            });
        });
    },

    renderEquipments(towerId) {
        const grid = document.getElementById('equipments-grid');
        let htmlChunks = [];

        let equipments = [];
        if (this.currentCityId) {
            const city = zabbixApiData.cities.find(c => c.id === this.currentCityId);
            if (city) {
                const tower = city.towers.find(t => t.id === towerId);
                if (tower) equipments = tower.equipments;
            }
        }

        equipments.forEach(eq => {
            const statusCounts = this.countStatuses(eq.alerts);
            htmlChunks.push(this.generateEntityCardHTML(eq.id, eq.name, statusCounts, `${eq.alerts.length} Alerta(s)`, eq.isAck, eq.ackUsers, false));
        });

        if (htmlChunks.length === 0) {
            htmlChunks.push('<div class="empty-message">Nenhum equipamento listado neste POP/Torre.</div>');
        }

        grid.innerHTML = htmlChunks.join('');

        grid.querySelectorAll('.entity-card').forEach(card => {
            card.addEventListener('click', () => {
                this.openAlertsView(card.getAttribute('data-id'));
            });
        });
    },

    renderAlerts(equipmentId) {
        const grid = document.getElementById('alerts-grid');
        let htmlChunks = [];

        let alerts = [];
        if (this.currentCityId && this.currentTowerId) {
            const city = zabbixApiData.cities.find(c => c.id === this.currentCityId);
            if (city) {
                const tower = city.towers.find(t => t.id === this.currentTowerId);
                if (tower) {
                    const eq = tower.equipments.find(e => e.id === equipmentId);
                    if (eq) alerts = eq.alerts;
                }
            }
        }

        alerts.forEach(al => {
            let statusCounts = {
                critical: { total: 0, unack: 0 },
                disaster: { total: 0, unack: 0 },
                attention: { total: 0, unack: 0 },
                ok: { total: 0, unack: 0 }
            };
            if (statusCounts[al.status] !== undefined) {
                statusCounts[al.status].total = 1;
                if (!al.acknowledged) statusCounts[al.status].unack = 1;
            } else {
                statusCounts.ok.total = 1;
            }

            let errorSubtext = (al.status !== 'ok' && al.error) ? al.error : 'Operacional';
            if (al.eventCount30d) {
                errorSubtext += ` &bull; ${al.eventCount30d} alerta(s) nos &uacute;ltimos 30 dias`;
            }
            htmlChunks.push(this.generateEntityCardHTML(al.id, al.name, statusCounts, errorSubtext, al.acknowledged, al.ackMessage, true));
        });

        if (htmlChunks.length === 0) {
            htmlChunks.push(`
            <div class="entity-card" data-id="ok">
                <div class="entity-indicators">
                    <div class="indicator purple "></div>
                    <div class="indicator red "></div>
                    <div class="indicator yellow "></div>
                    <div class="indicator green active"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg></div>
                </div>
                <div class="entity-name">
                    Equipamento Operacional
                    <span class="entity-subtext">Nenhum problema detectado</span>
                </div>
            </div>`);
        }

        grid.innerHTML = htmlChunks.join('');

        grid.querySelectorAll('.entity-card').forEach(card => {
            const commentIcon = card.querySelector('.comment-icon');
            if (commentIcon) {
                commentIcon.addEventListener('click', (e) => {
                    e.stopPropagation();
                    const text = commentIcon.getAttribute('data-comment');
                    document.getElementById('comment-text').innerText = text;
                    document.getElementById('comment-modal').style.display = 'flex';
                });
            }
        });
    },
    renderServerStats(equipmentId) {
        const container = document.getElementById('server-stats-container');
        if (!container) return;
        container.innerHTML = '';

        let equipment = null;
        for (const city of zabbixApiData.cities) {
            for (const tower of city.towers) {
                const eq = tower.equipments.find(e => e.id === equipmentId);
                if (eq) { equipment = eq; break; }
            }
            if (equipment) break;
        }

        if (!equipment) {
            container.style.display = 'none';
            return;
        }

        container.style.display = 'flex';

        const fmtPop = (val) => (val === null || val === undefined) ? 'N/A' : val;
        const fmtSrv = (val) => (val === null || val === undefined) ? 'N/A' : val + '%';
        const pct = (val) => (val === null || val === undefined) ? 0 : val;

        let cardContent = '';

        if (equipment.isPopProtect) {
            const m = equipment.metrics || { status: null, voltagem: null, temperatura: null, online: false };
            const labels = POP_METRICS_CONFIG.labels;

            cardContent = `
                <div class="server-header">
                    <div class="server-id-info">
                        <div class="server-icon">
                            ${m.image ? `<img src="${m.image}" alt="Device" style="width: 100%; height: 100%; object-fit: cover; border-radius: 10px;">` : 'POP'}
                        </div>
                        <div class="server-names">
                            <h3>${equipment.name}</h3>
                            <p>${equipment.ip}</p>
                        </div>
                    </div>
                    <div class="status-badge ${m.online ? '' : 'offline'}">
                        <div class="status-dot"></div>
                        ${m.online ? 'Online' : 'Offline'}
                    </div>
                </div>

                <div class="metric-row">
                    <div class="metric-label-group">
                        <span class="metric-name">${labels.status}</span>
                        <span class="metric-value">${parseInt(m.status) === 1 ? 'OK' : 'FALHA'}</span>
                    </div>
                    <div class="progress-container">
                        <div class="progress-bar" style="width: ${parseInt(m.status) === 1 ? 100 : 0}%"></div>
                    </div>
                </div>

                <div class="metric-row">
                    <div class="metric-label-group">
                        <span class="metric-name">${labels.voltagem}</span>
                        <span class="metric-value">${fmtPop(m.voltagem)}V</span>
                    </div>
                    <div class="progress-container">
                        <div class="progress-bar" style="width: ${Math.min(100, (pct(m.voltagem) / 54) * 100)}%"></div>
                    </div>
                </div>

                <div class="metric-row">
                    <div class="metric-label-group">
                        <span class="metric-name">${labels.temperatura}</span>
                        <span class="metric-value">${fmtPop(m.temperatura)}°C</span>
                    </div>
                    <div class="progress-container">
                        <div class="progress-bar" style="width: ${Math.min(100, (pct(m.temperatura) / 80) * 100)}%"></div>
                    </div>
                </div>

                <div class="uptime-label" style="display: flex; gap: 20px;">
                    <div>Ping: <span class="uptime-value">${m.online ? 'Operacional' : 'Falha'}</span></div>
                    ${m.uptime ? `<div>Uptime: <span class="uptime-value">${this.formatUptime(m.uptime)}</span></div>` : ''}
                </div>
            `;
        } else if (equipment.isServer) {
            const m = equipment.metrics || { cpu: null, memory: null, disk: null, uptime: 0, online: false };
            const uptimeStr = this.formatUptime(m.uptime);

            cardContent = `
                <div class="server-header">
                    <div class="server-id-info">
                        <div class="server-icon">
                            ${m.image ? `<img src="${m.image}" alt="Server" style="width: 100%; height: 100%; object-fit: cover; border-radius: 10px;">` : 'SVR'}
                        </div>
                        <div class="server-names">
                            <h3>${equipment.name}</h3>
                            <p>${equipment.ip}</p>
                        </div>
                    </div>
                    <div class="status-badge ${m.online ? '' : 'offline'}">
                        <div class="status-dot"></div>
                        ${m.online ? 'Online' : 'Offline'}
                    </div>
                </div>

                <div class="metric-row">
                    <div class="metric-label-group">
                        <span class="metric-name">${SERVER_METRICS_CONFIG.labels.cpu}</span>
                        <span class="metric-value">${fmtSrv(m.cpu)}</span>
                    </div>
                    <div class="progress-container">
                        <div class="progress-bar" style="width: ${pct(m.cpu)}%"></div>
                    </div>
                </div>

                <div class="metric-row">
                    <div class="metric-label-group">
                        <span class="metric-name">${SERVER_METRICS_CONFIG.labels.memory}</span>
                        <span class="metric-value">${fmtSrv(m.memory)}</span>
                    </div>
                    <div class="progress-container">
                        <div class="progress-bar" style="width: ${pct(m.memory)}%"></div>
                    </div>
                </div>

                <div class="metric-row">
                    <div class="metric-label-group">
                        <span class="metric-name">${SERVER_METRICS_CONFIG.labels.disk}</span>
                        <span class="metric-value">${fmtSrv(m.disk)}</span>
                    </div>
                    <div class="progress-container">
                        <div class="progress-bar" style="width: ${pct(m.disk)}%"></div>
                    </div>
                </div>

                <div class="uptime-label">
                    Uptime: <span class="uptime-value">${uptimeStr}</span>
                </div>
            `;
        } else {
            const m = equipment.metrics || { online: equipment.status !== 'disaster' && equipment.status !== 'critical', uptime: 0 };
            const uptimeStr = this.formatUptime(m.uptime);

            cardContent = `
                <div class="server-header">
                    <div class="server-id-info">
                        <div class="server-icon">
                            ${m.image ? `<img src="${m.image}" alt="Device" style="width: 100%; height: 100%; object-fit: cover; border-radius: 10px;">` : 'EQP'}
                        </div>
                        <div class="server-names">
                            <h3>${equipment.name}</h3>
                            <p>${equipment.ip}</p>
                        </div>
                    </div>
                    <div class="status-badge ${m.online ? '' : 'offline'}">
                        <div class="status-dot"></div>
                        ${m.online ? 'Online' : 'Offline'}
                    </div>
                </div>
                ${m.uptime ? `<div class="uptime-label">Uptime: <span class="uptime-value">${uptimeStr}</span></div>` : ''}
            `;
        }

        container.innerHTML = `
            <div class="server-stats-card">
                ${cardContent}
                
                <div class="availability-section" style="margin-top: 15px; padding-top: 15px; border-top: 1px solid rgba(255,255,255,0.1);">
                    <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
                        <span style="font-size: 0.9rem; color: #ccc;">Disponibilidade da Rede (30d)</span>
                        <span id="avail-value-${equipmentId}" style="font-weight: bold; color: #fff;">Carregando...</span>
                    </div>
                    <div style="display: flex; justify-content: space-between; align-items: flex-end;">
                        <div style="display: flex; flex-direction: column; gap: 4px; padding-right: 15px;">
                            <span style="font-size: 0.8rem; color: #888;">Top Indisponibilidade:</span>
                            <span id="avail-trigger-${equipmentId}" style="font-size: 0.85rem; color: #e74c3c;">Buscando dados reais...</span>
                        </div>
                        <span id="unavail-value-${equipmentId}" style="font-size: 0.85rem; color: #e74c3c; white-space: nowrap; font-weight: bold;"></span>
                    </div>
                </div>
            </div>
        `;
        this.loadAvailability(equipmentId);
    },


    formatUptime(seconds) {
        if (!seconds || isNaN(seconds)) return '0d 0h 0m';
        const d = Math.floor(seconds / 86400);
        const h = Math.floor((seconds % 86400) / 3600);
        const m = Math.floor((seconds % 3600) / 60);
        return `${d}d ${h}h ${m}m`;
    },

    async fetchGlobalAvailability() {
        if (!zabbixApiData || !zabbixApiData.cities || zabbixApiData.cities.length === 0) return;

        let hostIds = [];
        zabbixApiData.cities.forEach(city => {
            if (city.towers) {
                city.towers.forEach(tower => {
                    if (tower.equipments) {
                        tower.equipments.forEach(eq => hostIds.push(eq.id));
                    }
                });
            }
        });

        if (hostIds.length === 0) return;

        const timeFrom = Math.floor(Date.now() / 1000) - (30 * 24 * 60 * 60);
        const timeTill = Math.floor(Date.now() / 1000);
        const totalTime = timeTill - timeFrom;

        const triggers = await this.rpcCall('trigger.get', {
            hostids: hostIds,
            output: ['triggerid', 'value'],
            selectHosts: ['hostid'],
            monitored: 1,
            min_severity: 4
        });

        if (!triggers || triggers.error) return;

        const triggerIds = triggers.map(t => t.triggerid);

        const events = await this.rpcCall('event.get', {
            objectids: triggerIds,
            time_from: timeFrom,
            time_till: timeTill,
            sortfield: ['clock'],
            sortorder: 'DESC',
            output: ['objectid', 'clock', 'value'],
            value: [0, 1]
        });

        if (!events || events.error) return;

        const eventsByTrigger = {};
        triggerIds.forEach(id => eventsByTrigger[id] = []);
        events.forEach(ev => {
            if (eventsByTrigger[ev.objectid]) eventsByTrigger[ev.objectid].push(ev);
        });

        let hostDowntime = {};

        triggers.forEach(tr => {
            let downtime = 0;
            let t = timeTill;
            let state = parseInt(tr.value);
            const trEvents = eventsByTrigger[tr.triggerid];

            trEvents.forEach(ev => {
                let evClock = parseInt(ev.clock);
                let evValue = parseInt(ev.value);
                if (state === 1) downtime += (t - evClock);
                t = evClock;
                state = (evValue === 1 ? 0 : 1);
            });
            if (state === 1) downtime += (t - timeFrom);

            const hId = tr.hosts[0].hostid;
            hostDowntime[hId] = Math.max(hostDowntime[hId] || 0, downtime);
        });

        let equipAvails = {};
        for (let hostid in hostDowntime) {
            equipAvails[hostid] = 100 - ((hostDowntime[hostid] / totalTime) * 100);
        }

        app.availabilityData = { equipments: equipAvails, towers: {}, cities: {} };

        zabbixApiData.cities.forEach(city => {
            let citySum = 0;
            let cityCount = 0;
            if (city.towers) {
                city.towers.forEach(tower => {
                    let towerSum = 0;
                    let towerCount = 0;
                    if (tower.equipments) {
                        tower.equipments.forEach(eq => {
                            if (equipAvails[eq.id] !== undefined) {
                                towerSum += equipAvails[eq.id];
                                towerCount++;
                            }
                        });
                    }
                    if (towerCount > 0) {
                        app.availabilityData.towers[tower.id] = towerSum / towerCount;
                        citySum += (towerSum / towerCount);
                        cityCount++;
                    }
                });
            }
            if (cityCount > 0) {
                app.availabilityData.cities[city.id] = citySum / cityCount;
            }
        });
    },

    async loadAvailability(equipmentId) {
        try {
            const timeFrom = Math.floor(Date.now() / 1000) - (30 * 24 * 60 * 60);
            const timeTill = Math.floor(Date.now() / 1000);
            const totalTime = timeTill - timeFrom;

            const triggers = await this.rpcCall('trigger.get', {
                hostids: equipmentId,
                output: ['triggerid', 'description', 'value'],
                expandDescription: 1,
                monitored: 1,
                min_severity: 4
            });

            if (!triggers || triggers.error || triggers.length === 0) {
                this.updateAvailabilityUI(equipmentId, 100, "Nenhuma trigger mapeada");
                return;
            }

            const triggerIds = triggers.map(t => t.triggerid);
            const events = await this.rpcCall('event.get', {
                objectids: triggerIds,
                time_from: timeFrom,
                time_till: timeTill,
                sortfield: ['clock'],
                sortorder: 'DESC',
                output: ['objectid', 'clock', 'value'],
                value: [0, 1]
            });

            if (!events || events.error) {
                this.updateAvailabilityUI(equipmentId, 100, "Nenhum evento registrado");
                return;
            }

            const eventsByTrigger = {};
            triggerIds.forEach(id => eventsByTrigger[id] = []);
            events.forEach(ev => {
                if (eventsByTrigger[ev.objectid]) eventsByTrigger[ev.objectid].push(ev);
            });

            let maxDowntime = -1;
            let worstTrigger = null;

            triggers.forEach(tr => {
                let downtime = 0;
                let t = timeTill;
                let state = parseInt(tr.value);
                const trEvents = eventsByTrigger[tr.triggerid];

                trEvents.forEach(ev => {
                    let evClock = parseInt(ev.clock);
                    let evValue = parseInt(ev.value);

                    if (state === 1) downtime += (t - evClock);
                    t = evClock;
                    state = (evValue === 1 ? 0 : 1);
                });

                if (state === 1) downtime += (t - timeFrom);

                if (downtime > maxDowntime) {
                    maxDowntime = downtime;
                    worstTrigger = tr;
                }
            });

            if (!worstTrigger || maxDowntime === 0) {
                this.updateAvailabilityUI(equipmentId, 100, "Nenhuma indisponibilidade");
                return;
            }

            const availability = 100 - ((maxDowntime / totalTime) * 100);
            this.updateAvailabilityUI(equipmentId, availability, worstTrigger.description);

        } catch (err) {
            console.error("Erro ao calcular disponibilidade:", err);
            this.updateAvailabilityUI(equipmentId, null, "Erro na API Zabbix");
        }
    },

    updateAvailabilityUI(equipmentId, availability, triggerName) {
        const valEl = document.getElementById(`avail-value-${equipmentId}`);
        const trEl = document.getElementById(`avail-trigger-${equipmentId}`);
        const unavailEl = document.getElementById(`unavail-value-${equipmentId}`);
        
        if (valEl) {
            if (availability === null) valEl.innerText = "N/A";
            else {
                const formatted = availability.toFixed(2).replace('.', ',');
                valEl.innerText = `${formatted}%`;
                if (availability < 67) valEl.style.color = '#e74c3c';
                else if (availability < 87) valEl.style.color = '#f39c12';
                else valEl.style.color = '#2ecc71';
            }
        }
        if (trEl) {
            if (availability === 100 || triggerName === 'Nenhuma indisponibilidade') {
                trEl.innerText = triggerName;
                trEl.style.color = '#2ecc71';
                if (unavailEl) unavailEl.innerText = '';
            } else if (availability !== null) {
                const unavail = (100 - availability).toFixed(2).replace('.', ',');
                trEl.innerText = triggerName;
                trEl.style.color = '#e74c3c';
                if (unavailEl) {
                    unavailEl.innerText = `${unavail}%`;
                }
            } else {
                trEl.innerText = triggerName;
                if (unavailEl) unavailEl.innerText = '';
            }
        }
    },

};

window.addEventListener('DOMContentLoaded', () => {
    app.init();
});








