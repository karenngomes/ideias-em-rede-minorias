"""Gera a audiência fictícia 901 no formato documentado pela Thalia.

Tudo aqui é inventado. O script existe para que o mock seja reproduzível e
coerente: cada trecho citado no DQI, cada âncora de opinião e cada aresta do
grafo são derivados das falas abaixo e conferidos com assert.

    python3 data/mocks/gerar_mock.py
"""

import json
from pathlib import Path

OUT = Path(__file__).parent / "901"

PRES = "Deputada Ana Ribeiro"
PESSOAS = {
    PRES: ("Deputada (PSOL-RJ), presidente da sessão", "PSOL - RJ", "PRESIDENTE"),
    "Joana Santos": ("Rede de Mulheres Negras da Baixada", None, None),
    "Deputado Carlos Mendes": ("Deputado (PL-SP)", "PL - SP", None),
    "Lúcia Ferreira": ("Pesquisadora da Fiocruz", None, None),
    "Deputado Marcos Alves": ("Deputado (PT-BA)", "PT - BA", None),
    "Deputada Helena Costa": ("Deputada (UNIÃO-GO)", "UNIÃO - GO", None),
    "Paulo Lima": ("Ministério da Saúde", None, None),
    "Rita Oliveira": ("Conselho Nacional de Saúde", None, None),
}

TURNOS = [
    (PRES, "Declaro aberta a presente reunião de audiência pública destinada a debater o enfrentamento ao racismo institucional no acesso aos serviços públicos de saúde. É muito importante que esta Casa conheça essa realidade a partir de quem a vive e de quem a estuda, porque políticas desenhadas sem esse olhar tendem a repetir as desigualdades que dizem combater. Agradeço a presença das convidadas e dos convidados."),
    (PRES, "Concedo a palavra à Sra. Joana Santos, da Rede de Mulheres Negras da Baixada."),
    ("Joana Santos", "Obrigada, Presidente. Represento a Rede de Mulheres Negras da Baixada. Os dados que trouxemos mostram que mulheres negras esperam em média o dobro do tempo por atendimento pré-natal na rede pública da região. Isso não é acaso, é resultado de uma estrutura que decide quem merece cuidado. Precisamos que esta Casa aprove o protocolo de atendimento com recorte racial ainda neste semestre, porque cada mês de atraso custa vidas de mulheres e de bebês."),
    ("Deputado Carlos Mendes", "Com todo o respeito, eu discordo de tratar isso como questão racial. O problema é de gestão e de falta de recurso, e atinge todos os brasileiros pobres igualmente, sejam brancos ou negros. Criar protocolos separados por cor só divide a população e cria mais burocracia para quem já está sobrecarregado na ponta do sistema de saúde."),
    ("Joana Santos", "Deputado, se me permite, os números que apresentamos controlam por renda. Mesmo entre mulheres com a mesma renda, a diferença no tempo de espera"),
    (PRES, "Peço que aguardemos a ordem de inscrição, Sra. Joana, a senhora terá a palavra novamente. Concedo a palavra à Dra. Lúcia Ferreira, pesquisadora da Fiocruz."),
    ("Lúcia Ferreira", "Nossa pesquisa acompanhou mais de doze mil gestantes em três estados. A mortalidade materna entre mulheres negras foi quase duas vezes maior, e a diferença se mantém depois de ajustar por renda, escolaridade e região. Parte importante disso está no atendimento: mulheres negras recebem menos anestesia e têm suas queixas de dor desacreditadas com mais frequência. Por isso a formação dos profissionais é tão central quanto o financiamento."),
    ("Deputado Marcos Alves", "Quero registrar meu apoio ao que foi dito pela Dra. Lúcia e pela Sra. Joana. A formação dos profissionais precisa mudar, e isso começa na residência médica. Proponho que a comissão encaminhe ao Ministério da Educação a inclusão obrigatória de conteúdos sobre saúde da população negra nos programas de residência, com avaliação periódica dos resultados."),
    ("Deputada Helena Costa", "Eu reconheço a gravidade dos números, mas me preocupa o custo de implantar um protocolo novo em todo o país de uma vez. Os estados estão com orçamento apertado. Sugiro começar com um projeto piloto em alguns estados, medir o impacto com indicadores claros e só depois ampliar, para não criar uma obrigação que ninguém consegue cumprir."),
    (PRES, "Obrigada, Deputada. Concedo a palavra ao Sr. Paulo Lima, do Ministério da Saúde."),
    ("Paulo Lima", "O Ministério reconhece a desigualdade apontada pela Rede e pela Fiocruz e já elaborou uma proposta de indicador de equidade racial no monitoramento das unidades básicas. Sugerimos que o protocolo seja construído em conjunto com os estados, com metas graduais e financiamento federal na fase inicial, o que permitiria conciliar as preocupações orçamentárias levantadas pela Deputada Helena com a urgência trazida pela sociedade civil."),
    ("Deputado Carlos Mendes", "Essa proposta intermediária do Ministério me parece mais razoável do que um protocolo nacional imediato, desde que venha acompanhada de fonte de financiamento definida e de metas que possam ser fiscalizadas por esta comissão."),
    ("Rita Oliveira", "Falo pelo Conselho Nacional de Saúde. Há anos o controle social denuncia esse descaso, e há anos ouvimos que falta dinheiro. Não falta dinheiro, falta prioridade. Qualquer protocolo precisa ser acompanhado pelos conselhos locais e pelas comunidades atingidas, senão vira mais um documento na gaveta do gestor."),
    ("Deputado Carlos Mendes", "A senhora está politizando um debate técnico. Não é descaso, é limite orçamentário, e quem administra sabe disso."),
    ("Rita Oliveira", "Deputado, não é politizar reconhecer que as mesmas comunidades"),
    ("Deputado Carlos Mendes", "Não, não, deixe-me terminar, eu estava com a palavra."),
    (PRES, "Deputado, a palavra está com a Sra. Rita. Peço respeito à ordem dos trabalhos. Sra. Rita, por favor, conclua."),
    ("Rita Oliveira", "Obrigada, Presidente. Proponho que a comissão apoie a realização de conferências regionais de saúde da população negra, com participação dos conselhos locais, para que o protocolo seja construído com quem usa o serviço e não apenas com quem o administra. Isso fortalece o controle social e dá legitimidade ao que for aprovado aqui."),
    ("Lúcia Ferreira", "Complementando a proposta do Deputado Marcos, a mudança não pode ficar restrita à residência. É preciso revisar o currículo da graduação em medicina e enfermagem e oferecer formação continuada para quem já está no serviço, com materiais produzidos junto com as comunidades, porque o viés aparece no atendimento cotidiano, não só na formação inicial."),
    ("Deputado Marcos Alves", "Para dar concretude, vou apresentar emenda ao orçamento destinando cinquenta milhões de reais para a fase piloto do protocolo e para a formação continuada, como sugeriram a Dra. Lúcia e o Ministério. Assim respondemos à preocupação com financiamento levantada pelos colegas."),
    ("Deputada Helena Costa", "Com a emenda do Deputado Marcos, eu apoio o piloto. Proponho que ele comece em cinco estados de regiões diferentes, incluindo Goiás, e que a comissão receba relatórios semestrais com os indicadores de equidade propostos pelo Ministério."),
    ("Joana Santos", "Agradeço a todos. Queremos deixar claro que as mulheres negras não podem esperar mais um ciclo de estudos. Cada mês de atraso custa vidas. Pedimos que o piloto comece ainda este ano e que a Rede participe do comitê de acompanhamento junto com os conselhos locais."),
    (PRES, "Como encaminhamentos, a comissão vai aprovar requerimento de criação de grupo de trabalho sobre o protocolo, encaminhar ao Ministério da Educação a proposta sobre a residência médica e acompanhar a emenda orçamentária do Deputado Marcos. Nada mais havendo a tratar, declaro encerrada a reunião."),
]

# (id, falante, turno_id, texto da opinião, seção do resumo)
OPINIOES = [
    ("o::0000", PRES, 1, "defende debater o racismo institucional na saúde a partir de quem o vive", 3),
    ("o::0001", "Joana Santos", 3, "afirma que mulheres negras esperam o dobro do tempo por pré-natal", 0),
    ("o::0002", "Joana Santos", 3, "defende aprovar ainda neste semestre um protocolo de atendimento com recorte racial", 1),
    ("o::0003", "Deputado Carlos Mendes", 4, "considera que o problema é de gestão e de recursos, não racial", 0),
    ("o::0004", "Joana Santos", 5, "sustenta que a desigualdade persiste mesmo controlando por renda", 0),
    ("o::0005", "Lúcia Ferreira", 7, "aponta mortalidade materna quase duas vezes maior entre mulheres negras", 0),
    ("o::0006", "Deputado Marcos Alves", 8, "propõe incluir saúde da população negra na residência médica", 3),
    ("o::0007", "Deputada Helena Costa", 9, "teme o custo de um protocolo nacional e sugere um piloto", 2),
    ("o::0008", "Paulo Lima", 11, "propõe indicador de equidade racial e protocolo gradual com os estados", 1),
    ("o::0009", "Deputado Carlos Mendes", 12, "apoia a proposta intermediária se houver financiamento definido", 2),
    ("o::0010", "Rita Oliveira", 13, "afirma que falta prioridade, não dinheiro, e cobra controle social", 3),
    ("o::0011", "Deputado Carlos Mendes", 14, "atribui a situação a limite orçamentário, não a descaso", 2),
    ("o::0012", "Rita Oliveira", 18, "propõe conferências regionais de saúde da população negra", 3),
    ("o::0013", "Lúcia Ferreira", 19, "defende revisar currículos e oferecer formação continuada", 3),
    ("o::0014", "Deputado Marcos Alves", 20, "anuncia emenda de R$ 50 milhões para o piloto e a formação", 2),
    ("o::0015", "Deputada Helena Costa", 21, "apoia piloto em cinco estados com relatórios semestrais", 1),
    ("o::0016", "Joana Santos", 22, "pede que o piloto comece este ano com participação da Rede", 1),
]

SECOES = [
    ("Desigualdade racial no atendimento", "Joana Santos e Lúcia Ferreira apresentaram dados de espera no pré-natal e de mortalidade materna, sustentando que a diferença persiste mesmo controlando por renda; o deputado Carlos Mendes atribuiu o problema à gestão."),
    ("Protocolo com recorte racial", "A sociedade civil pediu um protocolo urgente; o Ministério propôs construção gradual com os estados e indicador de equidade, e a proposta de piloto ganhou apoio condicionado."),
    ("Financiamento", "A preocupação com custos levou à proposta de piloto; o Deputado Marcos Alves anunciou emenda de R$ 50 milhões, que destravou o apoio da Deputada Helena Costa."),
    ("Formação e controle social", "Propostas para a residência, a graduação e a formação continuada, e para que conselhos locais e comunidades acompanhem o protocolo."),
]

# (dimensão, nível, rótulo, turno_id, trecho literal ou None)
DQI = [
    ("participacao", 0, "interrompido", 5, None),
    ("participacao", 0, "interrompido", 15, None),
    ("justificacao_nivel", 2, "qualificada", 1, "porque políticas desenhadas sem esse olhar tendem a repetir as desigualdades que dizem combater"),
    ("justificacao_nivel", 2, "qualificada", 3, "porque cada mês de atraso custa vidas de mulheres e de bebês"),
    ("justificacao_nivel", 1, "inferior", 4, "Criar protocolos separados por cor só divide a população"),
    ("justificacao_nivel", 3, "sofisticada", 7, "a diferença se mantém depois de ajustar por renda, escolaridade e região"),
    ("justificacao_nivel", 2, "qualificada", 9, "para não criar uma obrigação que ninguém consegue cumprir"),
    ("justificacao_nivel", 3, "sofisticada", 11, "o que permitiria conciliar as preocupações orçamentárias levantadas pela Deputada Helena com a urgência trazida pela sociedade civil"),
    ("justificacao_nivel", 2, "qualificada", 18, "para que o protocolo seja construído com quem usa o serviço e não apenas com quem o administra"),
    ("justificacao_nivel", 2, "qualificada", 19, "porque o viés aparece no atendimento cotidiano, não só na formação inicial"),
    ("justificacao_conteudo", 3, "bem_comum_diferenca", 3, "Isso não é acaso, é resultado de uma estrutura que decide quem merece cuidado"),
    ("justificacao_conteudo", 2, "bem_comum_utilitario", 4, "atinge todos os brasileiros pobres igualmente"),
    ("justificacao_conteudo", 3, "bem_comum_diferenca", 7, "mulheres negras recebem menos anestesia e têm suas queixas de dor desacreditadas com mais frequência"),
    ("justificacao_conteudo", 0, "interesse_de_grupo", 21, "incluindo Goiás"),
    ("respeito_grupos", 2, "explicito_positivo", 11, "O Ministério reconhece a desigualdade apontada pela Rede e pela Fiocruz"),
    ("respeito_grupos", 0, "negativo", 4, "só divide a população"),
    ("respeito_demandas", 0, "negativo", 4, "eu discordo de tratar isso como questão racial"),
    ("respeito_demandas", 2, "explicito_positivo", 8, "Quero registrar meu apoio ao que foi dito pela Dra. Lúcia e pela Sra. Joana"),
    ("respeito_demandas", 2, "explicito_positivo", 11, "com a urgência trazida pela sociedade civil"),
    ("respeito_contra", 0, "degradante", 14, "A senhora está politizando um debate técnico"),
    ("respeito_contra", 1, "ignora", 4, None),
    ("respeito_contra", 3, "valoriza", 11, "conciliar as preocupações orçamentárias levantadas pela Deputada Helena"),
    ("respeito_contra", 2, "inclui", 19, "Complementando a proposta do Deputado Marcos"),
    ("respeito_contra", 3, "valoriza", 20, "como sugeriram a Dra. Lúcia e o Ministério"),
    ("politica_construtiva", 0, "posicional", 4, None),
    ("politica_construtiva", 1, "proposta_alternativa", 9, "Sugiro começar com um projeto piloto em alguns estados"),
    ("politica_construtiva", 2, "proposta_mediadora", 11, "Sugerimos que o protocolo seja construído em conjunto com os estados, com metas graduais"),
    ("politica_construtiva", 1, "proposta_alternativa", 18, "Proponho que a comissão apoie a realização de conferências regionais"),
    ("politica_construtiva", 2, "proposta_mediadora", 20, "Assim respondemos à preocupação com financiamento levantada pelos colegas"),
    ("politica_construtiva", 1, "proposta_alternativa", 21, "Proponho que ele comece em cinco estados de regiões diferentes"),
]

# Quem a matéria da Agência Câmara citou, e quantas opiniões atribuiu a cada um.
CITADOS = {PRES: 2, "Deputado Carlos Mendes": 2, "Paulo Lima": 1, "Deputado Marcos Alves": 2, "Deputada Helena Costa": 1}
CITADOS_AUSENTES = ["Ministra da Igualdade Racial"]


def main():
    OUT.mkdir(exist_ok=True)
    turnos, pos = [], 1000
    for tid, (nome, texto) in enumerate(TURNOS, start=1):
        cargo, partido, papel = PESSOAS[nome]
        raw = "PRESIDENTE" if papel else f"{'A SRA.' if nome.split()[0] in ('Joana', 'Lúcia', 'Rita', 'Deputada') else 'O SR.'} {nome.upper()}"
        turnos.append({"turno_id": tid, "falante_raw": raw, "falante_norm": nome, "papel": papel,
                       "partido": partido, "texto": texto, "char_start": pos, "char_end": pos + len(texto)})
        pos += len(texto) + 40
    by_id = {t["turno_id"]: t for t in turnos}

    for _, falante, tid, _, _ in OPINIOES:
        assert by_id[tid]["falante_norm"] == falante, f"âncora {tid} não é de {falante}"

    def palavras(tid):
        return len(by_id[tid]["texto"].split())

    envolvidos = []
    for nome, (cargo, _, _) in PESSOAS.items():
        tids = [t["turno_id"] for t in turnos if t["falante_norm"] == nome]
        protocolo = [tid for tid in tids if palavras(tid) < 50]
        envolvidos.append({
            "nome": nome, "cargo": cargo,
            "opinioes": [{"texto": texto, "ancora": {"turno_id": tid, "chunk_id": f"turno_{tid:04d}", "node_id": oid,
                                                     "char_start": by_id[tid]["char_start"], "char_end": by_id[tid]["char_end"]},
                          "nucleo": "", "qualificadores": []}
                         for oid, falante, tid, texto, _ in OPINIOES if falante == nome],
            "falas": [{"turno_id": tid, "tipo": "posicionamento" if any(o[2] == tid for o in OPINIOES) else "exposicao",
                       "resumo": by_id[tid]["texto"][:110].rsplit(" ", 1)[0] + "…"} for tid in tids if tid not in protocolo],
            "protocolo": protocolo,
            "resumo_geral": f"{nome} ({cargo}) falou em {len(tids)} turno(s).",
        })

    codigos = []
    for dim, nivel, rotulo, tid, trecho in DQI:
        turno = by_id[tid]
        codigo = {"dimensao": dim, "nivel": nivel, "rotulo": rotulo, "turno_id": tid, "falante": turno["falante_norm"],
                  "trecho": "", "char_start": None, "char_end": None, "fonte": "exato" if dim == "participacao" else "modelo"}
        if trecho:
            inicio = turno["texto"].index(trecho)  # falha se o trecho não for literal
            codigo.update(trecho=trecho, char_start=turno["char_start"] + inicio,
                          char_end=turno["char_start"] + inicio + len(trecho))
        codigos.append(codigo)
    codificados = sorted({t["turno_id"] for t in turnos if palavras(t["turno_id"]) >= 50})

    falantes = []
    for nome in PESSOAS:
        tids = [t["turno_id"] for t in turnos if t["falante_norm"] == nome]
        falantes.append({"nome": nome, "parlamentar": PESSOAS[nome][1] is not None, "mesa": nome == PRES,
                         "n_turnos": len(tids), "n_palavras": sum(palavras(tid) for tid in tids), "turnos": tids})

    def proporcoes(incluir_mesa):
        grupo = [f for f in falantes if incluir_mesa or not f["mesa"]]
        total = sum(f["n_palavras"] for f in grupo)
        civil = sum(f["n_palavras"] for f in grupo if not f["parlamentar"])
        citacoes = {f["nome"]: CITADOS.get(f["nome"], 0) for f in grupo}
        cit_total = sum(citacoes.values())
        cit_civil = sum(v for k, v in citacoes.items() if not PESSOAS[k][1])
        part, cit = round(civil / total, 3), round(cit_civil / cit_total, 3)
        return {"participacao_civil_palavras": part, "citacao_civil_opinioes": cit, "deficit_civil": round(part - cit, 3)}

    cobertura = {
        "sample_id": 901, "n_falantes": len(falantes),
        "n_parlamentares": sum(f["parlamentar"] for f in falantes), "n_convidados": sum(not f["parlamentar"] for f in falantes),
        "proporcoes": {"com_mesa": proporcoes(True), "sem_mesa": proporcoes(False)},
        "citados_ausentes": CITADOS_AUSENTES,
        "falantes_silenciados": [f["nome"] for f in falantes if f["nome"] not in CITADOS],
        "falantes": falantes,
    }

    nos = [{"id": f"p::{nome}", "tipo": "participante", "rotulo": nome,
            "dados": {"cargo": PESSOAS[nome][0], "n_opinioes": sum(o[1] == nome for o in OPINIOES)}} for nome in PESSOAS]
    nos += [{"id": oid, "tipo": "opiniao", "rotulo": texto,
             "dados": {"falante": falante, "turno_id": tid, "char_start": None, "char_end": None, "qualificadores": []}}
            for oid, falante, tid, texto, _ in OPINIOES]
    arestas = [{"origem": f"p::{falante}", "destino": oid, "tipo": "emitiu", "peso": 1.0, "dados": {}}
               for oid, falante, _, _, _ in OPINIOES]
    for anterior, atual in zip(turnos, turnos[1:]):
        if anterior["falante_norm"] != atual["falante_norm"]:
            arestas.append({"origem": f"p::{anterior['falante_norm']}", "destino": f"p::{atual['falante_norm']}",
                            "tipo": "fala_apos", "peso": 1.0, "dados": {"turno_id": atual["turno_id"]}})
    for turno in turnos:
        if turno["falante_norm"] == PRES and ("Concedo a palavra" in turno["texto"] or "a palavra está com" in turno["texto"]):
            seguinte = by_id.get(turno["turno_id"] + 1)
            if seguinte and seguinte["falante_norm"] != PRES:
                arestas.append({"origem": f"p::{PRES}", "destino": f"p::{seguinte['falante_norm']}",
                                "tipo": "concede_palavra", "peso": 1.0, "dados": {"turno_id": turno["turno_id"]}})
    for secao in range(len(SECOES)):
        membros = [o for o in OPINIOES if o[4] == secao]
        for a, b in zip(membros, membros[1:]):
            arestas.append({"origem": a[0], "destino": b[0], "tipo": "mesmo_tema", "peso": 0.7,
                            "dados": {"turno_id": max(a[2], b[2])}})

    resumo = {"secoes": [], "cobertura": {"participantes": len(PESSOAS), "participantes_total": len(PESSOAS), "taxa_participantes": 1.0}}
    for indice, (titulo, sintese) in enumerate(SECOES):
        membros = [o for o in OPINIOES if o[4] == indice]
        resumo["secoes"].append({
            "titulo": titulo, "sintese": sintese,
            "participantes": sorted({o[1] for o in membros}),
            "deriva_de": [o[0] for o in membros],
            "posicoes": [{"falante": o[1], "texto": o[3], "turno_id": o[2], "char_start": None, "char_end": None,
                          "qualificadores": []} for o in membros],
        })

    dqi = {"sample_id": 901, "n_turnos": len(turnos), "n_turnos_codificados": len(codificados),
           "n_codigos": len(codigos), "n_rejeitados": 0, "codigos": codigos, "rejeitados": [], "agregado": {}}
    clausulas = [{"turno_id": c["turno_id"], "texto": c["trecho"], "char_start": c["char_start"], "char_end": c["char_end"]}
                 for c in codigos if c["trecho"]]

    arquivos = {"turnos": turnos, "opinioes": {"assunto": "Enfrentamento ao racismo institucional no acesso à saúde", "envolvidos": envolvidos},
                "dqi": dqi, "cobertura": cobertura, "grafo": {"nos": nos, "arestas": arestas}, "resumo": resumo, "clausulas": clausulas}
    for nome, conteudo in arquivos.items():
        (OUT / f"{nome}.json").write_text(json.dumps(conteudo, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"{len(turnos)} turnos, {len(OPINIOES)} opiniões, {len(codigos)} códigos DQI, {len(arestas)} arestas")


if __name__ == "__main__":
    main()
