import dotenv from 'dotenv';
dotenv.config();
import { expect } from 'chai';
import Sybase from '../src/SybaseDB';
import { promisify, all } from 'bluebird';

//Configure To Connect To Your database on file .env:
const host = process.env.DB_TEST_HOST || '',
    port = process.env.DB_TEST_PORT || '',
    user = process.env.DB_TEST_USER || '',
    pw = process.env.DB_TEST_PASSWORD || '',
    db = process.env.DB_TEST_NAME || '';

describe('Node Sybase Bridge', function () {
    let subject: Sybase;
    let connectError: any = null;

    before(function (done) {
        subject = new Sybase(host, Number(port), db, user, pw, false, undefined, false);
        subject
            .connect()
            .then(() => {
                done();
            })
            .catch((err) => {
                connectError = err.toString();
                done(err);
            });
    });

    after(function (done) {
        subject.disconnect();
        done();
    });

    it('Connect', function (done) {
        expect(connectError).to.equal(null);
        expect(subject.isConnected).to.equal(true);
        done();
    });

    it('Simple Single Array Result', function (done) {
        if (!subject.isConnected) {
            expect(connectError).to.equal(null);
            done();
            return;
        }

        subject.query('SELECT top 1 * FROM DBA.Bandeira', function (err, data) {
            expect(err).to.equal(undefined);

            expect(data).to.be.a('array');
            expect(data.length).to.equal(1);
            done();
        });
    });

    it('Should work with updates async', async function () {
        if (!subject.isConnected) {
            expect(connectError).to.equal(null);
            return;
        }

        const results = await subject.executeAsync(
            'update DBA.Bandeira set BandeiraANP = descricao where codBandeira = 1',
        );
        expect(results).not.be.null;
    });

    it('Should work with inserts', function (done) {
        if (!subject.isConnected) {
            expect(connectError).to.equal(null);
            done();
            return;
        }

        subject.execute("DELETE DBA.Bandeira WHERE descricao ='TESTE NODE';", function (err, results) {
            if (err) {
                done(err);
            } else {
                expect(err).to.equal(undefined);
                expect(results).not.be.null;
                subject.execute(
                    "INSERT INTO DBA.Bandeira (codBandeira,descricao,BloqueadoVendas,BandeiraANP) VALUES ('79','TESTE NODE',1,'TESTE NODE');",
                    function (err, results) {
                        if (err) {
                            done(err);
                        } else {
                            expect(err).to.equal(undefined);
                            expect(results).not.be.null;
                            done();
                        }
                    },
                );
            }
        });
    });

    it('Should work with stored procedres', function (done) {
        if (!subject.isConnected) {
            expect(connectError).to.equal(null);
            done();
            return;
        }

        subject.execute('exec DBA.GetFrotaEntidade(1)', function (err, results) {
            if (err) {
                done(err);
            } else {
                expect(err).to.equal(undefined);
                expect(results).not.be.null;
                done();
            }
        });
    });

    it('Multiple async Calls (batch)', function (done) {
        if (!subject.isConnected) {
            expect(connectError).to.equal(null);
            done();
            return;
        }

        const pquery = promisify<any[], string>(subject.query, { context: subject });

        const pArray: any[] = [];

        for (let i = 0; i < 5; i++) {
            pArray.push(pquery('select top 1 * from DBA.Bandeira'));
        }

        all(pArray)
            .then(function (results) {
                results.forEach(function (data) {
                    expect(data).to.be.a('array');
                    expect(data.length).to.equal(1);
                });
                done();
            })
            .catch(function (err) {
                done(err);
            });
    });

    it('Batch with one error', function (done) {
        if (!subject.isConnected) {
            expect(connectError).to.equal(null);
            done();
            return;
        }

        const pquery = promisify<any[], string>(subject.query, { context: subject });

        const pArray: any[] = [];

        const badEgg = pquery('select * from tableThatDoesntExist');
        for (let i = 0; i < 5; i++) {
            pArray.push(pquery('select top 1 * from DBA.Bandeira'));
        }

        all(pArray)
            .then(function (results) {
                results.forEach(function (data) {
                    expect(data).to.be.a('array');
                    expect(data.length).to.equal(1);
                });
            })
            .catch(function (err) {
                done(err);
            });

        badEgg
            .then(function (results) {
                done(new Error('Expected an error from this call.'));
            })
            .catch(function (err) {
                //console.log("error:" + err.message);
                expect(err.message).to.contain('tableThatDoesntExist');
                done();
            });
    });
    it('Simple query async', async () => {
        if (!subject.isConnected) {
            expect(connectError).to.equal(null);
            return;
        }
        const data = await subject.queryAsync('select * from DBA.Bandeira');
        expect(data).to.be.a('array');
        expect(data.length).to.gte(1);
    });
    it('Simple Timeout', function (done) {
        if (!subject.isConnected) {
            expect(connectError).to.equal(null);
            done();
            return;
        }

        subject.query(
            'select * from DBA.Entidade',
            function (err, data) {
                expect(err.message).to.equal('Timeout');
                expect(data).to.be.null;
                done();
            },
            1000,
        );
    });
});
